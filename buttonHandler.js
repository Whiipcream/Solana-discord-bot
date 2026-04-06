const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { mainDashboard } = require('./dashboard'); 
const { getTrackedTraders, toggleTraderStatus, deleteTrader, getOrCreateWallet, addTrackedTrader, getTopTradersFeed } = require('./walletManager');

async function handleButtons(i, userId) {
    const cid = i.customId;

    try {
        // --- 1. MODALS (NO DEFER) ---
        const modalButtons = ['add_whale', 'trigger_withdraw_modal'];
        if (modalButtons.includes(cid) || cid.startsWith('set_limit_')) {
            const modal = new ModalBuilder();
            if (cid === 'add_whale') {
                modal.setCustomId('whale_modal').setTitle('Add Target');
                const addr = new TextInputBuilder().setCustomId('address').setLabel("Wallet Address").setStyle(TextInputStyle.Short).setRequired(true);
                const lim = new TextInputBuilder().setCustomId('limit').setLabel("Max SOL Limit").setStyle(TextInputStyle.Short).setValue("0.1").setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(addr), new ActionRowBuilder().addComponents(lim));
            }
            // (Add your withdraw modal logic here if needed)
            return await i.showModal(modal);
        }

        // --- 2. DEFER FOR DATA ---
        if (!i.deferred && !i.replied) await i.deferUpdate();

        // --- 3. NAVIGATION ---
        if (cid === 'back_main') {
            const dashboardData = await mainDashboard(userId);
            return await i.editReply(dashboardData);
        }

        if (cid === 'menu_discovery') {
            const tokens = await getTopTradersFeed();
            
            if (!tokens || tokens.length === 0) {
                return await i.editReply({ 
                    content: "⚠️ DexScreener is currently rate-limiting this IP. Please try again in 1 minute.", 
                    embeds: [], 
                    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary))]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🚀 Trending Solana Profiles')
                .setDescription('Latest token profiles updated on DexScreener.')
                .setColor('#00ffcc');

            const rows = tokens.map((t) => {
                embed.addFields({ name: t.symbol, value: `Address: \`${t.address.slice(0,8)}...\``, inline: true });
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`quick_copy_${t.address}`).setLabel(`Track ${t.symbol}`).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setLabel('Chart').setURL(`https://dexscreener.com/solana/${t.address}`).setStyle(ButtonStyle.Link)
                );
            });

            rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)));
            return await i.editReply({ embeds: [embed], components: rows });
        }

        // --- 4. OTHER MENUS ---
        if (cid === 'menu_copytrade') {
            const traders = await getTrackedTraders(userId);
            const embed = new EmbedBuilder().setTitle('👥 Tracked Targets').setColor('#2ecc71');
            const rows = traders.slice(0, 3).map(t => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`manage_trader_${t.id}`).setLabel(`${t.trader_address.slice(0,6)}...`).setStyle(ButtonStyle.Primary)
            ));
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_whale').setLabel('➕ Add Target').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            ));
            return await i.editReply({ embeds: [embed], components: rows });
        }

    } catch (error) {
        console.error("Button Error:", error);
    }
}

module.exports = { handleButtons };
