const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getOrCreateWallet } = require('./walletManager');

// --- THE FIX: DUAL-RPC STRATEGY ---
const RPC_ENDPOINTS = [
    "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f",
    "https://api.mainnet-beta.solana.com" // Backup Public RPC
];

async function getBalance(pubkey) {
    for (const url of RPC_ENDPOINTS) {
        try {
            console.log(`[SYSTEM] Attempting balance check via: ${url.split('?')[0]}`);
            
            const connection = new Connection(url, {
                commitment: 'confirmed',
                confirmTransactionInitialTimeout: 15000 
            });

            const pubKeyObject = new PublicKey(pubkey);
            const balance = await connection.getBalance(pubKeyObject);
            
            const solValue = (balance / 1000000000).toFixed(3);
            console.log(`✅ [SUCCESS] Found ${solValue} SOL`);
            return solValue;

        } catch (e) {
            console.error(`⚠️ [RETRY] RPC failed: ${e.message}`);
            // If this was the last endpoint, we've failed. Otherwise, loop to the next one.
        }
    }
    return "0.00 (Syncing...)"; 
}

const mainDashboard = async (userId) => {
    // 1. Get user's wallet info from DB
    const wallet = await getOrCreateWallet(userId);
    
    // 2. Fetch the real balance from the blockchain
    const actualBalance = await getBalance(wallet.publicKey);

    // 3. Build the Terminal UI
    return {
        embeds: [new EmbedBuilder()
            .setTitle('🍾 Champagne Services | Terminal')
            .setDescription(`**Wallet:** \`${wallet.publicKey}\`\n**Balance:** \`${actualBalance} SOL\``)
            .setColor('#FFD700')
            .setFooter({ text: 'Refresh by clicking any button or running /start' })],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('menu_positions').setLabel('📈 Positions').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('menu_copytrade').setLabel('👥 Copy Trade').setStyle(ButtonStyle.Success)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('menu_withdraw').setLabel('💸 Withdraw').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('menu_settings').setLabel('⚙️ Settings').setStyle(ButtonStyle.Secondary)
            )
        ]
    };
};

module.exports = { mainDashboard };
