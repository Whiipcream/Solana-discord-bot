const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getOrCreateWallet } = require('./walletManager');

const mainDashboard = async (userId) => {
    try {
        // 1. Get user's wallet info from DB + Birdeye Stats (Already synced in manager)
        const wallet = await getOrCreateWallet(userId);
        
        // 2. Build the Terminal UI using the Birdeye data
        const dashboardEmbed = new EmbedBuilder()
            .setTitle('🍾 Champagne Services | Terminal')
            .setDescription(`**Wallet Address:**\n\`${wallet.publicKey}\``)
            .addFields(
                { name: '💰 SOL Balance', value: `\`${wallet.solBalance} SOL\``, inline: true },
                { name: '💵 Net Worth', value: `\`${wallet.totalUsd}\``, inline: true },
                { name: '📦 Assets', value: `\`${wallet.tokenCount} Tokens\``, inline: true }
            )
            .setColor('#FFD700')
            .setTimestamp()
            .setFooter({ text: 'Live Birdeye Portfolio Sync' });

        return {
            embeds: [dashboardEmbed],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('menu_positions').setLabel('📈 Positions').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('menu_copytrade').setLabel('👥 Copy Trade').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('menu_discovery').setLabel('🔥 Explore').setStyle(ButtonStyle.Secondary)
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
            content: "⚠️ **Terminal Error:** Could not connect to the database or Birdeye. Please try again.",
            ephemeral: true 
        };
    }
};

module.exports = { mainDashboard };
p
