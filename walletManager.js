const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const NodeCache = require('node-cache');
const walletCache = new NodeCache(); // For launch, this stores wallets in memory.

function getOrCreateWallet(userId) {
    let walletData = walletCache.get(userId);
    if (!walletData) {
        const newKeypair = Keypair.generate();
        walletData = {
            publicKey: newKeypair.publicKey.toString(),
            secretKey: bs58.encode(newKeypair.secretKey)
        };
        walletCache.set(userId, walletData);
    }
    return walletData;
}

module.exports = { getOrCreateWallet };
