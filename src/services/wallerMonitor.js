const { Connection, PublicKey } = require('@solana/web3.js');
const { getTrackedWallets } = require('../database/walletManager');
const { executeSwap } = require('./tradeLogic');
require('dotenv').config();

const JUPITER_PROGRAM_ID = new PublicKey('JUP6LkbZbjS1jKKpphqEBYEVc2vM3qcshEt2ji5uZHO');
const RAYDIUM_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

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
  
  const trackedWallets = await getTrackedWallets();
  console.log(`Monitoring ${trackedWallets.length} wallets.`);

  trackedWallets.forEach(walletAddress => {
    try {
      const publicKey = new PublicKey(walletAddress);
      
      connection.onLogs(
        publicKey,
        async (logs, ctx) => {
          if (logs.err) return;

          // Check if logs contain Jupiter or Raydium program IDs
          const isJupiter = logs.logs.some(log => log.includes(JUPITER_PROGRAM_ID.toBase58()));
          const isRaydium = logs.logs.some(log => log.includes(RAYDIUM_PROGRAM_ID.toBase58()));

          if (isJupiter || isRaydium) {
            console.log(`Swap detected for wallet: ${walletAddress} (Sig: ${logs.signature})`);
            await processTransaction(connection, logs.signature, walletAddress);
          }
        },
        'confirmed'
      );
    } catch (err) {
      console.error(`Failed to subscribe to wallet ${walletAddress}:`, err);
    }
  });
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
      // Filter out SOL/WSOL (optional, depending on requirements)
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
