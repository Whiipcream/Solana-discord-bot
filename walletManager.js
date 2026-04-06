const { Client } = require('pg');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

const db = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

db.connect()
    .then(() => console.log('✅ Database Connected'))
    .catch(err => console.error('❌ DB Connection Error:', err));

// --- TABLES & MIGRATIONS ---
// 1. Create main tables
db.query(`CREATE TABLE IF NOT EXISTS champagne_wallets (user_id TEXT PRIMARY KEY, public_key TEXT NOT NULL, secret_key TEXT NOT NULL)`);
db.query(`CREATE TABLE IF NOT EXISTS champagne_wallets_traders (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, trader_address TEXT NOT NULL, status TEXT DEFAULT 'active')`);

// 2. CRITICAL: Add trade_limit column if it doesn't exist yet
db.query(`ALTER TABLE champagne_wallets_traders ADD COLUMN IF NOT EXISTS trade_limit TEXT DEFAULT '0.1'`);

const getOrCreateWallet = async (userId) => {
    const res = await db.query('SELECT * FROM champagne_wallets WHERE user_id = $1', [userId]);
    if (res.rows.length > 0) return { publicKey: res.rows[0].public_key, secretKey: res.rows[0].secret_key };
    
    const kp = Keypair.generate();
    const newWallet = { publicKey: kp.publicKey.toBase58(), secretKey: bs58.encode(kp.secretKey) };
    
    await db.query('INSERT INTO champagne_wallets (user_id, public_key, secret_key) VALUES ($1, $2, $3)', [userId, newWallet.publicKey, newWallet.secretKey]);
    return newWallet;
};

const addTrackedTrader = async (userId, address, limit) => {
    // This now properly includes the limit variable
    await db.query(
        'INSERT INTO champagne_wallets_traders (user_id, trader_address, trade_limit) VALUES ($1, $2, $3)', 
        [userId, address, limit]
    );
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
