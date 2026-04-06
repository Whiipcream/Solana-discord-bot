const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { mainDashboard } = require('./dashboard'); 
const { getTrackedTraders, toggleTraderStatus, deleteTrader, getOrCreateWallet, addTrackedTrader, getTopTradersFeed } = require('./walletManager');

async function handleButtons(i, userId) {
    const cid = i.customId;

    try {
        // --- STEP 1: MODAL TRIGGERS (Must be first, NO DEFER) ---
        const modalButtons = ['add_whale', 'trigger_withdraw_modal'];
        if (modalButtons.includes(cid) || cid.startsWith('set_limit_')) {
            const modal = new ModalBuilder();
            
            if (cid === 'add_whale') {
                modal.setCustomId('whale_modal').setTitle('Add Target');
                const addr = new TextInputBuilder().setCustomId('address').setLabel("Wallet Address").setStyle(TextInputStyle.Short).setRequired(true);
                const lim = new TextInputBuilder().setCustomId('limit').setLabel("Max SOL Limit").setStyle(TextInputStyle.Short).setValue("0.1").setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(addr), new ActionRowBuilder().addComponents(lim));
            } else if (cid === 'trigger_withdraw_modal') {
                modal.setCustomId('withdraw_modal').setTitle('Withdraw SOL');
                const addr = new TextInputBuilder().setCustomId('address').setLabel("Destination Address").setStyle(TextInputStyle.Short).setRequired(true);
                const amt = new TextInputBuilder().setCustomId('amount').setLabel("Amount").setStyle(TextInputStyle.Short).setPlaceholder("0.1").setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(addr), new ActionRowBuilder().addComponents(amt));
            }
            
            return await i.showModal(modal);
        }

        // --- STEP 2: DATA FETCHING (Now it is safe to defer) ---
        if (!i.deferred && !i.replied) {
            await i.deferUpdate().catch(() => null);
        }

        // --- STEP 3: NAVIGATION & LOGIC ---
        
        if (cid === 'back_main') {
            const dashboardData = await mainDashboard(userId);
            return await i.editReply(dashboardData);
        }

        if (cid === 'menu_discovery') {
            const tokens = await getTopTradersFeed();
            if (!tokens || tokens.length === 0) {
                return await i.editReply({ content: "⚠️ DexScreener is rate-limiting. Try again in 60s.", components: [
                    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary))
                ]});
            }

            const embed = new EmbedBuilder()
                .setTitle('🚀 Trending on Solana')
                .setDescription('Top active pairs. Click to track.')
                .setColor('#00ffcc');

            const rows = tokens.map((t) => {
                embed.addFields({ name: `${t.symbol}`, value: `Price: $${t.price}`, inline: true });
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`quick_copy_${t.address}`).setLabel(`Track ${t.symbol}`).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setLabel('Chart').setURL(`https://dexscreener.com/solana/${t.address}`).setStyle(ButtonStyle.Link)
                );
            });

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            ));

            return await i.editReply({ embeds: [embed], components: rows });
        }

        if (cid.startsWith('quick_copy_')) {
            const addr = cid.split('_')[2];
            await addTrackedTrader(userId, addr, "0.1");
            return await i.editReply({ content: `✅ Tracking: \`${addr}\``, embeds: [], components: [
                new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_main').setLabel('Main Menu').setStyle(ButtonStyle.Secondary))
            ]});
        }

        // Standard Menus
        if (cid === 'menu_positions' || cid === 'menu_withdraw' || cid === 'menu_copytrade') {
            let dashboardData;
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
            // Add other menu logic as needed...
        }

    } catch (error) {
        console.error("Button Error:", error);
    }
}

module.exports = { handleButtons };
