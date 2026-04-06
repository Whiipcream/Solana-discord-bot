const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { mainDashboard } = require('./dashboard'); 
const { getTrackedTraders, toggleTraderStatus, deleteTrader, getOrCreateWallet } = require('./walletManager');

async function handleButtons(i, userId) {
    try {
        const cid = i.customId;

        // --- 1. MODAL TRIGGERS (Must happen before any update/defer) ---
        if (cid === 'add_whale' || cid === 'trigger_withdraw_modal' || cid.startsWith('set_limit_')) {
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
            } else if (cid.startsWith('set_limit_')) {
                const id = cid.split('_')[2];
                modal.setCustomId(`limit_modal_${id}`).setTitle('Update Limit');
                const input = new TextInputBuilder().setCustomId('new_limit').setLabel("Max SOL").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
            }
            
            return await i.showModal(modal);
        }

        // --- 2. NAVIGATION & MENUS ---
        if (cid === 'back_main') {
            const dashboardData = await mainDashboard(userId);
            return await i.update(dashboardData);
        }

        if (cid === 'menu_positions') {
            const embed = new EmbedBuilder()
                .setTitle('📈 Your Positions')
                .setDescription('**Token:** `$SOL` | **Value:** 0.00\n*Select a coin below to manage individually.*')
                .setColor('#5865F2');
            const rows = [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sell_25').setLabel('Sell 25%').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('sell_all').setLabel('Sell All').setStyle(ButtonStyle.Danger)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('refresh_pos').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
                )
            ];
            return await i.update({ embeds: [embed], components: rows });
        }

        if (cid === 'menu_withdraw') {
            const wallet = await getOrCreateWallet(userId);
            const embed = new EmbedBuilder()
                .setTitle('💸 Withdraw Funds')
                .setDescription(`**Available Balance:** \`Checking...\`\n**From Bot Wallet:** \`${wallet.publicKey}\``)
                .setColor('#e74c3c');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_withdraw_modal').setLabel('Withdraw to Wallet').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            );
            return await i.update({ embeds: [embed], components: [row] });
        }

        if (cid === 'menu_copytrade') {
            const traders = await getTrackedTraders(userId);
            const embed = new EmbedBuilder().setTitle('👥 Copy Trade Settings').setColor('#2ecc71')
                .setDescription(traders.length > 0 ? 'Select a wallet to manage.' : 'No targets yet.');

            const rows = traders.slice(0, 4).map(t => new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`manage_trader_${t.id}`)
                    .setLabel(`${t.status === 'active' ? '🟢' : '⏸️'} ${t.trader_address.slice(0,6)}... (${t.trade_limit} SOL)`)
                    .setStyle(ButtonStyle.Primary)
            ));

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_whale').setLabel('➕ Add Target').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            ));
            return await i.update({ embeds: [embed], components: rows });
        }

        // --- 3. ACTIONS (Pause/Remove) ---
        if (cid.startsWith('pause_') || cid.startsWith('remove_')) {
            const id = cid.split('_')[1];
            
            // Acknowledge immediately so the user doesn't wait for DB
            if (!i.deferred && !i.replied) await i.deferUpdate();

            if (cid.startsWith('pause_')) await toggleTraderStatus(id);
            if (cid.startsWith('remove_')) await deleteTrader(id);
            
            const traders = await getTrackedTraders(userId);
            const embed = new EmbedBuilder().setTitle('👥 Copy Trade Settings').setColor('#2ecc71')
                .setDescription('✅ List Updated.');
            
            return await i.editReply({ embeds: [embed], content: null }); 
        }

    } catch (error) {
        console.error("Button Execution Error:", error);
        if (!i.replied && !i.deferred) {
            await i.reply({ content: "⚠️ System delay. Please try again.", ephemeral: true }).catch(() => null);
        }
    }
}

module.exports = { handleButtons };
