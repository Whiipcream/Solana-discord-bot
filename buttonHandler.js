const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { mainDashboard } = require('./ui/dashboard');
const { getTrackedTraders, toggleTraderStatus, deleteTrader, getOrCreateWallet } = require('./walletManager');

async function handleButtons(i, userId) {
    const cid = i.customId;

    if (cid === 'back_main') return await i.update(await mainDashboard(userId));

    // --- 👥 COPY TRADE MENU ---
    if (cid === 'menu_copytrade') {
        const traders = await getTrackedTraders(userId);
        const embed = new EmbedBuilder().setTitle('👥 Copy Trade Settings').setColor('#2ecc71')
            .setDescription(traders.length > 0 ? 'Select a wallet to manage.' : 'No targets yet.');

        const rows = traders.map(t => new ActionRowBuilder().addComponents(
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

    // --- ⚙️ MANAGE TRADER ---
    if (cid.startsWith('manage_trader_')) {
        const id = cid.split('_')[2];
        const embed = new EmbedBuilder().setTitle('⚙️ Manage Trader').setDescription('Adjust trade limits or status.').setColor('#f1c40f');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`pause_${id}`).setLabel('⏸️ Pause/Resume').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`set_limit_${id}`).setLabel('💰 Change Limit').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`remove_${id}`).setLabel('🗑️ Remove').setStyle(ButtonStyle.Danger)
        );
        return await i.update({ embeds: [embed], components: [row, new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_copytrade').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary))] });
    }

    // --- 🛠️ ACTIONS ---
    if (cid.startsWith('pause_')) {
        await toggleTraderStatus(cid.split('_')[1]);
        return await i.reply({ content: '✅ Status toggled!', ephemeral: true });
    }

    if (cid.startsWith('remove_')) {
        await deleteTrader(cid.split('_')[1]);
        return await i.reply({ content: '🗑️ Removed!', ephemeral: true });
    }

    if (cid.startsWith('set_limit_')) {
        const id = cid.split('_')[2];
        const modal = new ModalBuilder().setCustomId(`limit_modal_${id}`).setTitle('Update Limit');
        const input = new TextInputBuilder().setCustomId('new_limit').setLabel("Max SOL per trade").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await i.showModal(modal);
    }

    if (cid === 'add_whale') {
        const modal = new ModalBuilder().setCustomId('whale_modal').setTitle('Add Target');
        const addr = new TextInputBuilder().setCustomId('address').setLabel("Wallet Address").setStyle(TextInputStyle.Short).setRequired(true);
        const lim = new TextInputBuilder().setCustomId('limit').setLabel("Max SOL Limit").setStyle(TextInputStyle.Short).setValue("0.1").setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(addr), new ActionRowBuilder().addComponents(lim));
        return await i.showModal(modal);
    }
}

module.exports = { handleButtons };
