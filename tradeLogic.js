const { Connection, VersionedTransaction, Keypair } = require('@solana/web3.js');
const fetch = require('cross-fetch');
const bs58 = require('bs58');

async function executeSwap(userSecretKey, mint, amountSol, rpcUrl, feeWallet) {
    // 1. Setup Connection & Signer
    const connection = new Connection(rpcUrl, 'confirmed');
    const userKeypair = Keypair.fromSecretKey(bs58.decode(userSecretKey));
    
    // Convert SOL to Lamports (1 SOL = 1,000,000,000 Lamports)
    const lamports = Math.floor(amountSol * 1000000000);
    
    try {
        // 2. Get Quote from Jupiter V6
        // We set slippage to 100 (1%) and compute dynamic fees
        const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mint}&amount=${lamports}&slippageBps=100`;
        const quoteResponse = await fetch(quoteUrl).then(res => res.json());

        if (!quoteResponse || quoteResponse.error) {
            throw new Error(`Quote Failed: ${quoteResponse?.error || 'Unknown Error'}`);
        }

        // 3. Get the Swap Transaction
        const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse,
                userPublicKey: userKeypair.publicKey.toString(),
                wrapAndUnwrapSol: true,
                // This ensures your 1% fee is taken correctly
                feeAccount: feeWallet, 
                // Adds a tiny extra fee so the network processes your trade faster
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: 50000 
            })
        }).then(res => res.json());

        // 4. SIGN THE TRANSACTION
        // Jupiter returns a base64 string; we must turn it into a VersionedTransaction
        const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
        var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
        
        // Sign with the user's private key
        transaction.sign([userKeypair]);

        // 5. EXECUTE (Send to the Blockchain)
        const rawTransaction = transaction.serialize();
        const txid = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: true, // Faster execution
            maxRetries: 2
        });

        console.log(`✅ Trade Executed! TXID: https://solscan.io/tx/${txid}`);
        return txid;

    } catch (error) {
        console.error('❌ Trade Execution Failed:', error.message);
        return null;
    }
}

module.exports = { executeSwap };
