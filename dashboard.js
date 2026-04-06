const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getOrCreateWallet } = require('./walletManager');

// --- 🛠️ THE FIX: DUAL-RPC STRATEGY ---
// If Helius is under heavy load, it switches to Mainnet-Beta automatically.
const RPC_ENDPOINTS = [
    "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f",
    "https://api.mainnet-beta.solana.com" 
];

async function getBalance(pubkey) {
    for (const url of RPC_ENDPOINTS) {
        try {
            console.log(`[SYSTEM] Syncing with RPC: ${url.includes('helius') ? 'Helius' : 'Solana Mainnet'}`);
            
            const connection = new Connection(url, {
                commitment: 'confirmed',
                confirmTransactionInitialTimeout: 30000 
            });

            const pubKeyObject = new PublicKey(pubkey);
            
            // Bypass basic caching by fetching full AccountInfo
            const accountInfo = await connection.getAccountInfo(pubKeyObject);
            
            // If accountInfo is null, the wallet is brand new (0 SOL)
            const lamports = accountInfo ? accountInfo.lamports : 0;
            const solValue = (lamports / 1000000000).toFixed(3);
            
            console.log(`✅ [SUCCESS] ${url.includes('helius') ? 'Helius' : 'Mainnet'} reported ${solValue} SOL`);
            return solValue;

        } catch (e) {
            console.error(`⚠️ [RPC ERROR] ${url.includes('helius') ? 'Helius' : 'Mainnet'} timed out: ${e.message}`);
            // Wait slightly before trying the backup
            await new Promise(res => setTimeout(res, 1500));
        }
    }
    return "0.00 (Network Lag)"; 
}

const mainDashboard = async (userId) => {
    try {
        // 1. Get user's wallet info from DB
        const wallet = await getOrCreateWallet(userId);
        
        // 2. Fetch the real balance from the blockchain (AWAITED)
        const actualBalance = await getBalance(wallet.publicKey);

        // 3. Build the Terminal UI
        const dashboardEmbed = new EmbedBuilder()
            .setTitle('🍾 Champagne Services | Terminal')
            .setDescription(`**Wallet Address:**\n\`${wallet.publicKey}\`\n\n**Available Balance:**\n\`${actualBalance} SOL\``)
            .setColor('#FFD700')
            .setTimestamp()
            .setFooter({ text: 'Real-time Chain Sync' });

        return {
            embeds: [dashboardEmbed],
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
        console.error("CRITICAL: Dashboard Build Error:", err);
        return { 
            content: "⚠️ **Terminal Error:** Could not connect to the database or blockchain. Please try again in a few seconds.",
            ephemeral: true 
        };
    }
};

module.exports = { mainDashboard };
