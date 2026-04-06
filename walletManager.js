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

// --- 🌐 BIRDEYE API INSTANCE (The Fix) ---
const birdeye = axios.create({
    baseURL: 'https://public-api.birdeye.so',
    headers: { 
        // .trim() ensures no hidden spaces from Render copy-pasting
        'X-API-KEY': (process.env.BIRDEYE_API_KEY || '').trim(), 
        'x-chain': 'solana',
        'accept': 'application/json'
    },
    timeout: 8000 // Increased timeout for slower API responses
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

// --- 📊 BIRDEYE PORTFOLIO LOGIC ---
async function getWalletStats(address) {
    try {
        const res = await birdeye.get('/v1/wallet/token_list', {
            params: { wallet: address }
        });
        
        if (!res.data || !res.data.data) throw new Error("No data returned");
        
        const data = res.data.data;
        const solToken = data.items.find(i => i.symbol === 'SOL');
        
        return {
            solBalance: solToken ? solToken.uiAmount.toFixed(3) : "0.000",
            totalUsd: data.totalUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            tokenCount: data.items.length
        };
    } catch (e) {
        console.error(`❌ Birdeye Sync Error [${e.response?.status || 'Timeout'}]:`, e.message);
        return { solBalance: "0.000", totalUsd: "$0.00", tokenCount: 0 };
    }
}

// --- 🔥 DISCOVERY FEED (The 400 & 429 Fix) ---
async function getTopTradersFeed() {
    try {
        const res = await birdeye.get('/trader/gainers-losers', {
            params: {
                type: 'today',
                sort_by: 'pnl',
                limit: 5
            }
        });
        
        if (res.data && res.data.success && res.data.data) {
            return res.data.data.items || [];
        }
        return [];
    } catch (e) {
        // If we hit a 429, we log it clearly so you know to slow down clicks
        if (e.response?.status === 429) {
            console.warn("⚠️ Rate Limit Hit: Birdeye Free Tier allows 1 req/sec.");
        } else {
            console.error(`❌ Top Traders Error [${e.response?.status}]:`, e.message);
        }
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
