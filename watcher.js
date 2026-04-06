const { Connection, PublicKey } = require('@solana/web3.js');
const { Client } = require('pg');
const { executeSwap } = require('./tradeLogic');

const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
db.connect();

async function startWatching(rpcUrl, wsUrl, feeWallet) {
    const connection = new Connection(rpcUrl, { wsEndpoint: wsUrl, commitment: 'confirmed' });
    console.log("🔍 Champagne Watcher: Monitoring Blockchain via Helius...");

    // This listens for any "Logs" on the network
    connection.onLogs("all", async (logs) => {
        // We look for Jupiter or Raydium swap signatures in the logs
        if (logs.logs.some(l => l.includes("Jupiter") || l.includes("raydium"))) {
            
            // Get the list of people we are tracking from the DB
            const tracked = await db.query('SELECT * FROM champagne_wallets_traders WHERE status = $1', ['active']);
            
            for (const whale of tracked.rows) {
                // Check if the transaction involves the whale we are following
                const txInfo = await connection.getTransaction(logs.signature, { maxSupportedTransactionVersion: 0 });
                
                if (txInfo && txInfo.transaction.message.staticAccountKeys.some(k => k.toString() === whale.trader_address)) {
                    console.log(`🎯 TARGET DETECTED: ${whale.trader_address} just traded!`);
                    
                    // Identify the Token (Mint) bought
                    const postBalances = txInfo.meta.postTokenBalances;
                    const boughtToken = postBalances.find(b => b.owner === whale.trader_address && b.mint !== "So11111111111111111111111111111111111111112");

                    if (boughtToken) {
                        console.log(`💸 Copying Buy for Mint: ${boughtToken.mint}`);
                        
                        // Get the user's secret key to sign the trade
                        const userRes = await db.query('SELECT secret_key FROM champagne_wallets WHERE user_id = $1', [whale.user_id]);
                        
                        if (userRes.rows.length > 0) {
                            await executeSwap(
                                userRes.rows[0].secret_key,
                                boughtToken.mint,
                                parseFloat(whale.trade_limit),
                                rpcUrl,
                                feeWallet
                            );
                        }
                    }
                }
            }
        }
    }, 'confirmed');
}

module.exports = { startWatching };
