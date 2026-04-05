const { Connection, PublicKey, VersionedTransaction } = require('@solana/web3.js');
const fetch = require('cross-fetch');

async function executeSwap(userKeypair, mint, amountSol, rpcUrl, feeWallet) {
    const connection = new Connection(rpcUrl, 'confirmed');
    const lamports = amountSol * 1000000000;
    
    // 1. Get Quote
    const quote = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mint}&amount=${lamports}&slippageBps=100`).then(res => res.json());

    // 2. Get Swap Transaction with 1% Fee built-in
    const { swapTransaction } = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: userKeypair.publicKey.toString(),
            feeAccount: feeWallet // Your 1% wallet
        })
    }).then(res => res.json());

    return swapTransaction;
}

module.exports = { executeSwap };
