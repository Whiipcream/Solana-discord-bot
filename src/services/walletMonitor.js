const { Connection, PublicKey } = require('@solana/web3.js');
const { getTrackedWallets } = require('../database/walletManager');
const { executeSwap } = require('./tradeLogic');
require('dotenv').config();

const JUPITER_PROGRAM_ID = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
const RAYDIUM_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

// Map to keep track of active log subscriptions
const activeSubscriptions = new Map();

/**
 * Starts the wallet monitoring system.
 * @param {string} rpcUrl - Helius RPC URL.
 * @param {string} wssUrl - Helius WSS URL.
 */
async function startMonitoring(rpcUrl, wssUrl) {
  const connection = new Connection(rpcUrl, {
    wsEndpoint: wssUrl,
    commitment: 'confirmed',
  });

  console.log('--- Wallet Monitor Started ---');

  // Initial sync
  await syncTrackedWallets(connection);

  // Periodically refresh tracked wallets from DB (every 60 seconds)
  setInterval(async () => {
    await syncTrackedWallets(connection);
  }, 60000);
}

/**
 * Syncs the active log subscriptions with the tracked wallets in the database.
 * @param {Connection} connection
 */
async function syncTrackedWallets(connection) {
  try {
    const trackedWallets = await getTrackedWallets();
    const currentWallets = Array.from(activeSubscriptions.keys());

    // Add new subscriptions
    for (const walletAddress of trackedWallets) {
      if (!activeSubscriptions.has(walletAddress)) {
        try {
          const publicKey = new PublicKey(walletAddress);
          const subId = connection.onLogs(
            publicKey,
            async (logs) => {
              if (logs.err) return;

              const isJupiter = logs.logs.some(log => log.includes(JUPITER_PROGRAM_ID.toBase58()));
              const isRaydium = logs.logs.some(log => log.includes(RAYDIUM_PROGRAM_ID.toBase58()));

              if (isJupiter || isRaydium) {
                console.log(`Swap detected for wallet: ${walletAddress} (Sig: ${logs.signature})`);
                await processTransaction(connection, logs.signature, walletAddress);
              }
            },
            'confirmed'
          );
          activeSubscriptions.set(walletAddress, subId);
          console.log(`Started monitoring: ${walletAddress}`);
        } catch (err) {
          console.error(`Failed to subscribe to wallet ${walletAddress}:`, err);
        }
      }
    }

    // Remove old subscriptions
    for (const walletAddress of currentWallets) {
      if (!trackedWallets.includes(walletAddress)) {
        const subId = activeSubscriptions.get(walletAddress);
        try {
          await connection.removeOnLogsListener(subId);
          activeSubscriptions.delete(walletAddress);
          console.log(`Stopped monitoring: ${walletAddress}`);
        } catch (err) {
          console.error(`Failed to remove subscription for ${walletAddress}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Error syncing tracked wallets:', err);
  }
}

/**
 * Processes a transaction to identify the purchased token mint.
 * @param {Connection} connection
 * @param {string} signature
 * @param {string} walletAddress
 */
async function processTransaction(connection, signature, walletAddress) {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    if (!tx || !tx.meta) return;

    const { postTokenBalances, preTokenBalances } = tx.meta;

    // Find token accounts belonging to the tracked wallet where balance increased
    const purchasedToken = postTokenBalances.find(post => {
      const pre = preTokenBalances.find(p => p.accountIndex === post.accountIndex);
      const preAmount = pre ? pre.uiTokenAmount.uiAmount : 0;
      const postAmount = post.uiTokenAmount.uiAmount;

      return post.owner === walletAddress && postAmount > preAmount;
    });

    if (purchasedToken && purchasedToken.mint) {
      const tokenMint = purchasedToken.mint;
      // Filter out SOL/WSOL
      if (tokenMint !== 'So11111111111111111111111111111111111111112') {
        console.log(`Identified purchased token mint: ${tokenMint}`);
        await executeSwap(tokenMint, walletAddress);
      }
    }
  } catch (err) {
    console.error(`Error processing transaction ${signature}:`, err);
  }
}

module.exports = {
  startMonitoring,
};
