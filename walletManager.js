const { Client } = require('pg');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

// Connects using your Render Database URL
const db = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

db.connect()
    .then(() => console.log('✅ Connected to Champagne Postgres Database'))
    .catch(err => console.error('❌ Database connection error', err));

// 1. Create the Main Wallets Table
db.query(`
    CREATE TABLE IF NOT EXISTS champagne_wallets (
        user_id TEXT PRIMARY KEY,
        public_key TEXT NOT NULL,
        secret_key TEXT NOT NULL
    )
`);

// 2. Create the Tracked Traders Table (This fixed the button issue)
db.query(`
    CREATE TABLE IF NOT EXISTS champagne_wallets_traders (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        trader_address TEXT NOT NULL,
        status TEXT DEFAULT 'active'
    )
`);

const getOrCreateWallet = async (userId) => {
    try {
        const res = await db.query('SELECT * FROM champagne_wallets WHERE user_id = $1', [userId]);
        
        if (res.rows.length > 0) {
            return {
                publicKey: res.rows[0].public_key,
                secretKey: res.rows[0].secret_key
            };
        }

        const kp = Keypair.generate();
        const newWallet = {
            publicKey: kp.publicKey.toBase58(),
            secretKey: bs58.encode(kp.secretKey)
        };

        await db.query(
            'INSERT INTO champagne_wallets (user_id, public_key, secret_key) VALUES ($1, $2, $3)',
            [userId, newWallet.publicKey, newWallet.secretKey]
        );

        console.log(`💎 Permanent Wallet generated and saved for user ${userId}`);
        return newWallet;

    } catch (error) {
        console.error('❌ Wallet Retrieval Error:', error);
        throw error;
    }
};

// --- NEW FIXES FOR COPY TRADE ---

const addTrackedTrader = async (userId, traderAddress) => {
    try {
        await db.query(
            'INSERT INTO champagne_wallets_traders (user_id, trader_address, status) VALUES ($1, $2, $3)',
            [userId, traderAddress, 'active']
        );
        console.log(`✅ Trader ${traderAddress} saved for user ${userId}`);
    } catch (error) {
        console.error('❌ Error saving trader:', error);
        throw error;
    }
};

const getTrackedTraders = async (userId) => {
    try {
        const res = await db.query('SELECT * FROM champagne_wallets_traders WHERE user_id = $1', [userId]);
        return res.rows;
    } catch (error) {
        console.error('❌ Error fetching traders:', error);
        return [];
    }
};

// Export ALL functions so index.js can use them
module.exports = { 
    getOrCreateWallet, 
    addTrackedTrader, 
    getTrackedTraders 
};
