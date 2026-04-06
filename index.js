const express = require('express');
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType, REST, Routes 
} = require('discord.js');
const { getOrCreateWallet } = require('./walletManager');
require('dotenv').config();

// --- RENDER HEARTBEAT ---
const app = express();
app.get('/', (req, res) => res.send('Champagne Terminal is Online! 🥂'));
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`Heartbeat listening on port ${port}`));

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// --- UI GENERATORS ---
const mainDashboard = (userId) => {
    const wallet = getOrCreateWallet(userId);
    return {
        embeds: [new EmbedBuilder()
            .setTitle('🍾 Champagne Services | Terminal')
            .setDescription(`**Wallet:** \`${wallet.publicKey}\`\n**Balance:** \`0.00 SOL\``)
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

// --- CLIENT LOGIC ---
client.on('ready', async () => {
    console.log(`🚀 Logged in as ${client.user.tag}`);
    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error refreshing commands:', error);
    }
});

client.on('interactionCreate', async (i) => {
    const userId = i.user.id;

    // 1. Handle Slash Commands
    if (i.isChatInputCommand()) {
        if (i.commandName === 'start') return await i.reply(mainDashboard(userId));
    }

    // 2. Handle Buttons
    if (i.isButton()) {
        if (i.customId === 'menu_positions') {
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
            await i.update({ embeds: [embed], components: rows });
        }

        if (i.customId === 'menu_copytrade') {
            const embed = new EmbedBuilder()
                .setTitle('👥 Copy Trade Settings')
                .setDescription('**Targets:** `None`\nMonitor wallets and mimic their buys/sells instantly.')
                .setColor('#2ecc71');
            const rows = [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('add_whale').setLabel('➕ Add Wallet').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('pause_copy').setLabel('⏸️ Pause').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('remove_whale').setLabel('🗑️ Remove').setStyle(ButtonStyle.Danger)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
                )
            ];
            await i.update({ embeds: [embed], components: rows });
        }

        if (i.customId === 'menu_withdraw') {
            const wallet = getOrCreateWallet(userId);
            const embed = new EmbedBuilder()
                .setTitle('💸 Withdraw Funds')
                .setDescription(`**Available Balance:** \`0.00 SOL\`\n**From Bot Wallet:** \`${wallet.publicKey}\``)
                .setColor('#e74c3c');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_withdraw_modal').setLabel('Withdraw to Real Wallet').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            );
            await i.update({ embeds: [embed], components: [row] });
        }

        if (i.customId === 'menu_settings') {
            const embed = new EmbedBuilder()
                .setTitle('⚙️ Dashboard Settings')
                .addFields({ name: 'Slippage', value: '`1.0%`', inline: true }, { name: 'Priority Fee', value: '`Turbo`', inline: true })
                .setColor('#95a5a6');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_slippage').setLabel('Slippage').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('export_key').setLabel('🔑 Export Key').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            );
            await i.update({ embeds: [embed], components: [row] });
        }

        if (i.customId === 'back_main') await i.update(mainDashboard(userId));

        if (i.customId === 'add_whale' || i.customId === 'trigger_withdraw_modal') {
            const isWhale = i.customId === 'add_whale';
            const modal = new ModalBuilder()
                .setCustomId(isWhale ? 'whale_modal' : 'withdraw_modal')
                .setTitle(isWhale ? 'Add Target Wallet' : 'Withdraw SOL');
            const input = new TextInputBuilder()
                .setCustomId('address')
                .setLabel(isWhale ? "Target Wallet Address" : "Destination Wallet Address")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            const amount = new TextInputBuilder()
                .setCustomId('amount')
                .setLabel(isWhale ? "Max SOL per trade" : "Amount to withdraw")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("e.g. 0.1")
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input), new ActionRowBuilder().addComponents(amount));
            await i.showModal(modal);
        }
    }

    // 3. Handle Modal Submissions (THIS WAS THE MISSING PART)
    if (i.type === InteractionType.ModalSubmit) {
        if (i.customId === 'whale_modal') {
            const address = i.fields.getTextInputValue('address');
            const amount = i.fields.getTextInputValue('amount');
            
            // This is where you'd save to a database. For now, we confirm it worked:
            await i.reply({ content: `✅ **Success!** Now tracking: \`${address}\` with a \`${amount} SOL\` limit.`, ephemeral: true });
        }
        
        if (i.customId === 'withdraw_modal') {
            const address = i.fields.getTextInputValue('address');
            const amount = i.fields.getTextInputValue('amount');
            await i.reply({ content: `💸 **Withdrawal Initiated:** Sending \`${amount} SOL\` to \`${address}\`.`, ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
