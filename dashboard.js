const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getOrCreateWallet } = require('./walletManager');

// --- THE FIX: DUAL-RPC STRATEGY ---
const RPC_ENDPOINTS = [
    "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f",
    "https://api.mainnet-beta.solana.com" 
];

async function getBalance(pubkey) {
    for (const url of RPC_ENDPOINTS) {
        try {
            console.log(`[SYSTEM] Attempting balance check via: ${url.split('?')[0]}`);
            
            const connection = new Connection(url, {
                commitment: 'confirmed',
                confirmTransactionInitialTimeout: 20000 // 20 seconds for slow networks
            });

            const pubKeyObject = new PublicKey(pubkey);
            
            // Adding a small delay for the first attempt to allow network propagation
            const balance = await connection.getBalance(pubKeyObject);
            
            const solValue = (balance / 1000000000).toFixed(3);
            
            // If balance is exactly 0, we log it specifically to help you debug
            if (parseFloat(solValue) === 0) {
                console.log(`ℹ️ [DB] Wallet ${pubkey} is currently empty on this RPC.`);
            } else {
                console.log(`✅ [SUCCESS] Found ${solValue} SOL`);
            }
            
            return solValue;

        } catch (e) {
            console.error(`⚠️ [RETRY] RPC failed: ${e.message}`);
            // Wait 1 second before trying the next RPC
            await new Promise(res => setTimeout(res, 1000));
        }
    }
    return "0.00 (Syncing...)"; 
}

const mainDashboard = async (userId) => {
    try {
        // 1. Get user's wallet info from DB
        const wallet = await getOrCreateWallet(userId);
        
        // 2. Fetch the real balance from the blockchain
        const actualBalance = await getBalance(wallet.publicKey);

        // 3. Build the Terminal UI
        return {
            embeds: [new EmbedBuilder()
                .setTitle('🍾 Champagne Services | Terminal')
                .setDescription(`**Wallet Address:**\n\`${wallet.publicKey}\`\n\n**Available Balance:**\n\`${actualBalance} SOL\``)
                .setColor('#FFD700')
                .setTimestamp()
                .setFooter({ text: 'Updates every /start or button click' })],
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
    } catch (err) {
        console.error("Dashboard Build Error:", err);
        return { content: "⚠️ Error loading dashboard. Check bot logs." };
    }
};

module.exports = { mainDashboard };
