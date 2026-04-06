const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getOrCreateWallet } = require('./walletManager');

// Helper to get actual balance from the blockchain
async function getBalance(pubkey) {
    const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const connection = new Connection(HELIUS_RPC, 'confirmed');
    try {
        const balance = await connection.getBalance(new PublicKey(pubkey));
        return (balance / 1000000000).toFixed(3); // Convert lamports to SOL
    } catch (e) {
        console.error("Blockchain Balance Error:", e.message);
        return "0.00"; // Fallback if network is laggy
    }
}

const mainDashboard = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    
    // FETCH THE ACTUAL BALANCE
    const actualBalance = await getBalance(wallet.publicKey);

    return {
        embeds: [new EmbedBuilder()
            .setTitle('🍾 Champagne Services | Terminal')
            .setDescription(`**Wallet:** \`${wallet.publicKey}\`\n**Balance:** \`${actualBalance} SOL\``)
            .setColor('#FFD700')
            .setFooter({ text: 'Deposit SOL to the address above to fund your bot.' })],
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
