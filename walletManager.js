const { Pool } = require('pg');
const { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js'); // Added Solana web3 imports
const bs58 = require('bs58');

// --- 🛠️ CONNECTION POOL ---
const db = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

db.on('error', (err) => console.error('⚠️ Unexpected DB error:', err));

// --- 🚀 DATABASE SETUP ---
async function setupDatabase() {
    try {
        await db.query(`CREATE TABLE IF NOT EXISTS champagne_wallets (user_id TEXT PRIMARY KEY, public_key TEXT NOT NULL, secret_key TEXT NOT NULL)`);
        await db.query(`CREATE TABLE IF NOT EXISTS champagne_wallets_traders (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, trader_address TEXT NOT NULL, status TEXT DEFAULT 'active', trade_limit TEXT DEFAULT '0.1')`);
        await db.query(`ALTER TABLE champagne_wallets_traders ADD COLUMN IF NOT EXISTS trade_limit TEXT DEFAULT '0.1'`);
        console.log('✅ [DB] Schema is verified and up to date.');
    } catch (err) {
        console.error('❌ [DB] Setup Error:', err);
    }
}
setupDatabase();

// --- 🌐 SOLANA BALANCE LOGIC ---
async function getBalance(publicKeyString) {
    try {
        // Using your Helius RPC
        const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f");
        const pubKey = new PublicKey(publicKeyString);
        
        // AWAIT the network response to stop the 0.00 issue
        const balance = await connection.getBalance(pubKey);
        
        return (balance / LAMPORTS_PER_SOL).toFixed(4); 
    } catch (e) {
        console.error("Balance Fetch Error:", e);
        return "0.0000";
    }
}

// --- 💳 WALLET LOGIC ---
const getOrCreateWallet = async (userId) => {
    try {
        const res = await db.query('SELECT * FROM champagne_wallets WHERE user_id = $1', [userId]);
        let wallet;

        if (res.rows.length > 0) {
            wallet = { 
                publicKey: res.rows[0].public_key, 
                secretKey: res.rows[0].secret_key 
            };
        } else {
            // Generate NEW if none exists
            const kp = Keypair.generate();
            wallet = { 
                publicKey: kp.publicKey.toBase58(), 
                secretKey: bs58.encode(kp.secretKey) 
            };
            await db.query('INSERT INTO champagne_wallets (user_id, public_key, secret_key) VALUES ($1, $2, $3)', 
                [userId, wallet.publicKey, wallet.secretKey]);
        }
        
        // ATTACH LIVE BALANCE before returning
        wallet.balance = await getBalance(wallet.publicKey);
        return wallet;

    } catch (err) {
        console.error('❌ [DB] Error in getOrCreateWallet:', err.message);
        throw err;
    }
};

// --- 👥 TRADER MANAGEMENT ---
const addTrackedTrader = async (userId, address, limit) => {
    try {
        await db.query(
            'INSERT INTO champagne_wallets_traders (user_id, trader_address, trade_limit) VALUES ($1, $2, $3)', 
            [userId, address, limit]
        );
    } catch (err) {
        console.error('❌ [DB] Error adding trader:', err.message);
        throw err;
    }
};

const getTrackedTraders = async (userId) => {
    const res = await db.query('SELECT * FROM champagne_wallets_traders WHERE user_id = $1 ORDER BY id DESC', [userId]);
    return res.rows;
};

const deleteTrader = async (id) => {
    await db.query('DELETE FROM champagne_wallets_traders WHERE id = $1', [id]);
};

const toggleTraderStatus = async (id) => {
    const res = await db.query('SELECT status FROM champagne_wallets_traders WHERE id = $1', [id]);
    if (res.rows.length === 0) return;
    const newStatus = res.rows[0].status === 'active' ? 'paused' : 'active';
    await db.query('UPDATE champagne_wallets_traders SET status = $1 WHERE id = $2', [newStatus, id]);
};

const updateTraderLimit = async (id, newLimit) => {
    await db.query('UPDATE champagne_wallets_traders SET trade_limit = $1 WHERE id = $2', [newLimit, id]);
};

module.exports = { 
    getOrCreateWallet, 
    getBalance, // Exported so dashboard can use it for refreshes
    addTrackedTrader, 
    getTrackedTraders, 
    deleteTrader, 
    toggleTraderStatus, 
    updateTraderLimit 
};
