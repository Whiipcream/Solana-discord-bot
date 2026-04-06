const express = require('express');
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType, REST, Routes 
} = require('discord.js');
const { 
    getOrCreateWallet, addTrackedTrader, getTrackedTraders, 
    deleteTrader, toggleTraderStatus, updateTraderLimit 
} = require('./walletManager');
require('dotenv').config();

const app = express();
app.get('/', (req, res) => res.send('Champagne Terminal Online! 🥂'));
app.listen(process.env.PORT || 3000);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const mainDashboard = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    return {
        embeds: [new EmbedBuilder()
            .setTitle('🍾 Champagne Services | Terminal')
            .setDescription(`**Wallet:** \`${wallet.publicKey}\`\n**Balance:** \`0.00 SOL\``)
            .setColor('#FFD700')],
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

client.on('interactionCreate', async (i) => {
    const userId = i.user.id;

    if (i.isChatInputCommand() && i.commandName === 'start') return await i.reply(await mainDashboard(userId));

    if (i.isButton()) {
        // --- 👥 COPY TRADE MAIN MENU ---
        if (i.customId === 'menu_copytrade') {
            const traders = await getTrackedTraders(userId);
            const embed = new EmbedBuilder().setTitle('👥 Copy Trade Settings').setColor('#2ecc71')
                .setDescription(traders.length > 0 ? 'Select a wallet to manage settings or status.' : 'No targets yet.');

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
            await i.update({ embeds: [embed], components: rows });
        }

        // --- ⚙️ MANAGE INDIVIDUAL TRADER ---
        if (i.customId.startsWith('manage_trader_')) {
            const id = i.customId.split('_')[2];
            const embed = new EmbedBuilder().setTitle('⚙️ Manage Trader').setDescription('Adjust trade limits or change status.').setColor('#f1c40f');
            
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`pause_${id}`).setLabel('⏸️ Pause/Resume').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`set_limit_${id}`).setLabel('💰 Change Limit').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`remove_${id}`).setLabel('🗑️ Remove').setStyle(ButtonStyle.Danger)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('menu_copytrade').setLabel('⬅️ Back to List').setStyle(ButtonStyle.Secondary)
            );
            await i.update({ embeds: [embed], components: [row1, row2] });
        }

        // --- 🛠️ ACTIONS: PAUSE / REMOVE / LIMIT ---
        if (i.customId.startsWith('pause_')) {
            const id = i.customId.split('_')[1];
            await toggleTraderStatus(id);
            await i.reply({ content: '✅ Status toggled successfully!', ephemeral: true });
        }

        if (i.customId.startsWith('remove_')) {
            const id = i.customId.split('_')[1];
            await deleteTrader(id);
            await i.reply({ content: '🗑️ Trader removed from your database.', ephemeral: true });
        }

        if (i.customId.startsWith('set_limit_')) {
            const id = i.customId.split('_')[2];
            const modal = new ModalBuilder().setCustomId(`limit_modal_${id}`).setTitle('Update Trade Limit');
            const input = new TextInputBuilder().setCustomId('new_limit').setLabel("Max SOL per trade").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 0.5").setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await i.showModal(modal);
        }

        if (i.customId === 'back_main') await i.update(await mainDashboard(userId));
        
        if (i.customId === 'add_whale') {
            const modal = new ModalBuilder().setCustomId('whale_modal').setTitle('Add Target');
            const addr = new TextInputBuilder().setCustomId('address').setLabel("Wallet Address").setStyle(TextInputStyle.Short).setRequired(true);
            const lim = new TextInputBuilder().setCustomId('limit').setLabel("Max SOL Limit").setStyle(TextInputStyle.Short).setValue("0.1").setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(addr), new ActionRowBuilder().addComponents(lim));
            await i.showModal(modal);
        }
    }

    // --- 📝 MODAL SUBMISSIONS ---
    if (i.type === InteractionType.ModalSubmit) {
        if (i.customId === 'whale_modal') {
            const address = i.fields.getTextInputValue('address');
            const limit = i.fields.getTextInputValue('limit');
            await addTrackedTrader(userId, address, limit);
            await i.reply({ content: `✅ Now tracking ${address} with a ${limit} SOL limit.`, ephemeral: true });
        }

        if (i.customId.startsWith('limit_modal_')) {
            const id = i.customId.split('_')[2];
            const newLimit = i.fields.getTextInputValue('new_limit');
            await updateTraderLimit(id, newLimit);
            await i.reply({ content: `✅ Limit updated to ${newLimit} SOL.`, ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
