const { Pool } = require('pg');
const { Keypair, Connection, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const axios = require('axios');

// --- 🛠️ CONNECTIONS ---
const db = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false },
    max: 10
});

// Use your Helius RPC URL from Render env variables
const connection = new Connection(process.env.RPC_URL || "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY");

// --- 📊 JUPITER & DEXSCREENER INSTANCES (No Keys Required) ---
const jupiter = axios.create({ baseURL: 'https://api.jup.ag/price/v2' });
const dexscreener = axios.create({ baseURL: 'https://api.dexscreener.com/latest/dex' });

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

// --- 📈 NEW: GET WALLET STATS (Blockchain Native) ---
async function getWalletStats(address) {
    try {
        const pubKey = new PublicKey(address);
        
        // 1. Fetch raw SOL balance directly from the chain
        const balance = await connection.getBalance(pubKey);
        const solAmount = balance / 1e9;

        // 2. Fetch SOL Price from Jupiter
        const priceRes = await jupiter.get('', { 
            params: { ids: 'So11111111111111111111111111111111111111112' } 
        });
        const solPrice = priceRes.data.data['So11111111111111111111111111111111111111112']?.price || 0;

        const totalUsd = solAmount * solPrice;

        return {
            solBalance: solAmount.toFixed(3),
            totalUsd: totalUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            tokenCount: "Active" 
        };
    } catch (e) {
        console.error("❌ Stats Sync Error:", e.message);
        return { solBalance: "0.000", totalUsd: "$0.00", tokenCount: 0 };
    }
}

// --- 🔥 NEW: DISCOVERY FEED (DexScreener Trending) ---
async function getTopTradersFeed() {
    try {
        // Fetch trending Solana pairs
        const res = await dexscreener.get('/tokens/v1/solana/So11111111111111111111111111111111111111112');
        
        if (!res.data || !Array.isArray(res.data)) return [];

        // Return top 5 pairs formatted for your Discord buttons
        return res.data.slice(0, 5).map(pair => ({
            address: pair.baseToken.address, // The token mint address
            symbol: pair.baseToken.symbol,
            price: pair.priceUsd,
            pnl_percent: parseFloat(pair.priceChange?.h24 || 0)
        }));
    } catch (e) {
        console.error("❌ DexScreener Error:", e.message);
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
