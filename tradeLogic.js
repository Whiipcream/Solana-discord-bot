const { Connection, VersionedTransaction, Keypair } = require('@solana/web3.js');
const fetch = require('cross-fetch');
const bs58 = require('bs58');

async function executeSwap(userSecretKey, mint, amountSol, rpcUrl, feeWallet) {
    const connection = new Connection(rpcUrl, 'confirmed');
    const userKeypair = Keypair.fromSecretKey(bs58.decode(userSecretKey));
    const lamports = Math.floor(amountSol * 1000000000);
    
    try {
        const quote = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mint}&amount=${lamports}&slippageBps=100`).then(res => res.json());

        const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse: quote,
                userPublicKey: userKeypair.publicKey.toString(),
                feeAccount: feeWallet,
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: 100000 // Priority tip for speed
            })
        }).then(res => res.json());

        const transaction = VersionedTransaction.deserialize(Buffer.from(swapRes.swapTransaction, 'base64'));
        transaction.sign([userKeypair]);

        const txid = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
        console.log(`✅ Trade Success: https://solscan.io/tx/${txid}`);
        return txid;
    } catch (e) {
        console.error("❌ Swap Error:", e.message);
    }
}

module.exports = { executeSwap };
