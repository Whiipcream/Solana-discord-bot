const { Client } = require('pg');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

// Connects using that URL you just added to Render
const db = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Render Postgres connections
});

db.connect()
    .then(() => console.log('✅ Connected to Champagne Postgres Database'))
    .catch(err => console.error('❌ Database connection error', err));

// Creates the "Safe" table if it doesn't exist
db.query(`
    CREATE TABLE IF NOT EXISTS champagne_wallets (
        user_id TEXT PRIMARY KEY,
        public_key TEXT NOT NULL,
        secret_key TEXT NOT NULL
    )
`);

const getOrCreateWallet = async (userId) => {
    try {
        // 1. Check the database for this specific user
        const res = await db.query('SELECT * FROM champagne_wallets WHERE user_id = $1', [userId]);
        
        if (res.rows.length > 0) {
            return {
                publicKey: res.rows[0].public_key,
                secretKey: res.rows[0].secret_key
            };
        }

        // 2. If user is brand new, generate a permanent wallet
        const kp = Keypair.generate();
        const newWallet = {
            publicKey: kp.publicKey.toBase58(),
            secretKey: bs58.encode(kp.secretKey)
        };

        // 3. Lock it into the database forever
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

module.exports = { getOrCreateWallet };
