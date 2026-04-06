const { Pool } = require('pg');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const axios = require('axios');

// --- 🛠️ CONNECTION POOL ---
const db = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// --- 🌐 BIRDEYE API INSTANCE ---
const birdeye = axios.create({
    baseURL: 'https://public-api.birdeye.so',
    headers: { 
        'X-API-KEY': process.env.BIRDEYE_API_KEY, 
        'x-chain': 'solana' 
    }
});

// --- 🚀 DATABASE SETUP ---
async function setupDatabase() {
    try {
        await db.query(`CREATE TABLE IF NOT EXISTS champagne_wallets (user_id TEXT PRIMARY KEY, public_key TEXT NOT NULL, secret_key TEXT NOT NULL)`);
        await db.query(`CREATE TABLE IF NOT EXISTS champagne_wallets_traders (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, trader_address TEXT NOT NULL, status TEXT DEFAULT 'active', trade_limit TEXT DEFAULT '0.1')`);
        await db.query(`ALTER TABLE champagne_wallets_traders ADD COLUMN IF NOT EXISTS trade_limit TEXT DEFAULT '0.1'`);
        console.log('✅ [DB] Schema verified.');
    } catch (err) {
        console.error('❌ [DB] Setup Error:', err);
    }
}
setupDatabase();

// --- 📊 BIRDEYE PORTFOLIO LOGIC (Replaces old getBalance) ---
async function getWalletStats(address) {
    try {
        // From your screenshot: Wallet Portfolio / Token List
        const res = await birdeye.get(`/v1/wallet/token_list?wallet=${address}`);
        const data = res.data.data;
        
        const solToken = data.items.find(i => i.symbol === 'SOL');
        
        return {
            solBalance: solToken ? solToken.uiAmount.toFixed(3) : "0.000",
            totalUsd: data.totalUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            tokenCount: data.items.length
        };
    } catch (e) {
        console.error("Birdeye Sync Error:", e.message);
        return { solBalance: "0.000", totalUsd: "$0.00", tokenCount: 0 };
    }
}

// --- 🔥 DISCOVERY FEED (From your "Gainers/Losers" screenshot) ---
async function getTopTradersFeed() {
    try {
        const res = await birdeye.get('/trader/gainers-losers?type=today&sort_by=pnl&limit=5');
        return res.data.data.items; 
    } catch (e) {
        console.error("Top Traders Error:", e.message);
        return [];
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
            const kp = Keypair.generate();
            wallet = { 
                publicKey: kp.publicKey.toBase58(), 
                secretKey: bs58.encode(kp.secretKey) 
            };
            await db.query('INSERT INTO champagne_wallets (user_id, public_key, secret_key) VALUES ($1, $2, $3)', 
                [userId, wallet.publicKey, wallet.secretKey]);
        }
        
        // ATTACH BIRDEYE STATS
        const stats = await getWalletStats(wallet.publicKey);
        return { ...wallet, ...stats };

    } catch (err) {
        console.error('❌ [DB] Wallet Error:', err.message);
        throw err;
    }
};

// --- 👥 TRADER MANAGEMENT ---
const addTrackedTrader = async (userId, address, limit) => {
    await db.query('INSERT INTO champagne_wallets_traders (user_id, trader_address, trade_limit) VALUES ($1, $2, $3)', [userId, address, limit]);
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

module.exports = { 
    getOrCreateWallet, 
    getWalletStats,
    getTopTradersFeed,
    addTrackedTrader, 
    getTrackedTraders, 
    deleteTrader, 
    toggleTraderStatus 
};
