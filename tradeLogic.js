const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const fetch = require('cross-fetch');

async function getJupiterSwap(userPublicKey, mintAddress, amountInSol) {
    // 1. Convert SOL to Lamports (1 SOL = 1,000,000,000 Lamports)
    const amount = amountInSol * 1e9;

    // 2. Get the best price from Jupiter Aggregator
    const quote = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mintAddress}&amount=${amount}&slippageBps=100`).then(res => res.json());

    // 3. Build the Swap Transaction
    const { swapTransaction } = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: userPublicKey,
            wrapAndUnwrapSol: true,
            prioritizationFeeLamports: 50000 // Turbo Speed
        })
    }).then(res => res.json());

    return swapTransaction;
}

// COPY TRADING LOGIC
async function monitorWhale(whaleAddress) {
    console.log(`👀 Monitoring ${whaleAddress} for new trades...`);
    // This would use a WebSocket to watch for 'logs' from the whale's wallet
    // When whale buys -> This bot triggers the getJupiterSwap function instantly
}

module.exports = { getJupiterSwap, monitorWhale };
