const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getOrCreateWallet } = require('./walletManager');

// --- 🛠️ THE "BULLETPROOF" CONNECTION ---
// We define this OUTSIDE the function so it stays "warm"
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
const connection = new Connection(HELIUS_RPC, {
    commitment: 'confirmed',
    fetchMiddleware: (url, options) => {
        options.timeout = 15000; // Give it 15 seconds to respond
        return fetch(url, options);
    }
});

async function getBalance(pubkey) {
    for (let i = 0; i < 3; i++) {
        try {
            console.log(`[Attempt ${i+1}] Checking balance for: ${pubkey}`);
            const balance = await connection.getBalance(new PublicKey(pubkey));
            return (balance / 1000000000).toFixed(3); 
        } catch (e) {
            console.error(`❌ Balance Fetch Failed: ${e.message}`);
            // Wait 2 seconds before trying again
            await new Promise(res => setTimeout(res, 2000));
        }
    }
    return "0.00 (Syncing...)"; 
}

const mainDashboard = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    
    // This is the line that actually pulls the money info
    const actualBalance = await getBalance(wallet.publicKey);

    return {
        embeds: [new EmbedBuilder()
            .setTitle('🍾 Champagne Services | Terminal')
            .setDescription(`**Wallet:** \`${wallet.publicKey}\`\n**Balance:** \`${actualBalance} SOL\``)
            .setColor('#FFD700')
            .setFooter({ text: 'If balance is 0.00, click a button to refresh.' })],
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
