const { Pool } = require('pg');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

// --- 🛠️ CONNECTION POOL (Fixes Database Timeouts) ---
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
        
        // Ensure trade_limit exists if table was created before the column was added
        await db.query(`ALTER TABLE champagne_wallets_traders ADD COLUMN IF NOT EXISTS trade_limit TEXT DEFAULT '0.1'`);
        
        console.log('✅ [DB] Schema is verified and up to date.');
    } catch (err) {
        console.error('❌ [DB] Setup Error:', err);
    }
}
setupDatabase();

// --- 💳 WALLET LOGIC ---
const getOrCreateWallet = async (userId) => {
    try {
        const res = await db.query('SELECT * FROM champagne_wallets WHERE user_id = $1', [userId]);
        
        if (res.rows.length > 0) {
            console.log(`📂 [DB] Loaded existing wallet for ${userId}: ${res.rows[0].public_key}`);
            return { 
                publicKey: res.rows[0].public_key, 
                secretKey: res.rows[0].secret_key 
            };
        }
        
        // If no wallet exists, generate a new one
        const kp = Keypair.generate();
        const newWallet = { 
            publicKey: kp.publicKey.toBase58(), 
            secretKey: bs58.encode(kp.secretKey) 
        };
        
        console.log(`🆕 [DB] Creating NEW wallet for ${userId}: ${newWallet.publicKey}`);
        await db.query('INSERT INTO champagne_wallets (user_id, public_key, secret_key) VALUES ($1, $2, $3)', 
            [userId, newWallet.publicKey, newWallet.secretKey]);
            
        return newWallet;
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
        console.log(`✅ [DB] Added trader ${address} for user ${userId}`);
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
    addTrackedTrader, 
    getTrackedTraders, 
    deleteTrader, 
    toggleTraderStatus, 
    updateTraderLimit 
};
