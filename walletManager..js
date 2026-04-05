const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

// In a real pro version, you'd save these to a database (MongoDB). 
// For now, this generates a fresh one when they start.
function generateUserWallet() {
    const keypair = Keypair.generate();
    return {
        publicKey: keypair.publicKey.toString(),
        secretKey: bs58.encode(keypair.secretKey)
    };
}

module.exports = { generateUserWallet };
