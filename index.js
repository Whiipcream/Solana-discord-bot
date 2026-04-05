const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const { getOrCreateWallet } = require('./walletManager'); // Ensure filename matches
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// --- UI REPOSITORY (The "Trojan" Look) ---

const mainDashboard = (userId) => {
    const wallet = getOrCreateWallet(userId);
    return {
        embeds: [new EmbedBuilder()
            .setTitle('🍾 Champagne Terminal | Main Menu')
            .setDescription(`**Wallet:** \`${wallet.publicKey}\`\n**Balance:** \`0.00 SOL\``)
            .setColor('#FFD700')
            .setFooter({ text: 'Deposit SOL to start trading.' })],
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

// --- INTERACTION HANDLER ---

client.on('messageCreate', async (m) => {
    if (m.content === '/start') await m.reply(mainDashboard(m.author.id));
});

client.on('interactionCreate', async (i) => {
    const userId = i.user.id;

    // 1. POSITIONS MENU
    if (i.customId === 'menu_positions') {
        const embed = new EmbedBuilder()
            .setTitle('📈 Current Positions')
            .setDescription('**Token A:** 0.5 SOL (+12%)\n**Token B:** 1.2 SOL (-2%)')
            .setColor('#5865F2');

        const rows = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('sell_25').setLabel('Sell 25%').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('sell_50').setLabel('Sell 50%').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('sell_all').setLabel('Sell 100%').setStyle(ButtonStyle.Danger)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('refresh_pos').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            )
        ];
        await i.update({ embeds: [embed], components: rows });
    }

    // 2. COPYTRADE MENU
    if (i.customId === 'menu_copytrade') {
        const embed = new EmbedBuilder()
            .setTitle('👥 Copy Trade Center')
            .setDescription('**Active Targets:** 0\n**Total Profit Followed:** 0.00 SOL')
            .setColor('#2ecc71');

        const rows = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_whale').setLabel('➕ Add Wallet').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('pause_all').setLabel('⏸️ Pause All').setStyle(ButtonStyle.Secondary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            )
        ];
        await i.update({ embeds: [embed], components: rows });
    }

    // 3. WITHDRAW MENU
    if (i.customId === 'menu_withdraw') {
        const wallet = getOrCreateWallet(userId);
        const embed = new EmbedBuilder()
            .setTitle('💸 Withdraw SOL')
            .setDescription(`**Available:** \`0.00 SOL\`\n**From:** \`${wallet.publicKey}\``)
            .setColor('#e74c3c');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('trigger_withdraw').setLabel('Confirm Withdrawal').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
        );
        await i.update({ embeds: [embed], components: [row] });
    }

    // 4. SETTINGS MENU
    if (i.customId === 'menu_settings') {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Bot Settings')
            .setDescription('Configure your trading engine defaults.')
            .addFields(
                { name: 'Default Slippage', value: '`1.0%`', inline: true },
                { name: 'MEV Turbo', value: '`Enabled`', inline: true }
            )
            .setColor('#95a5a6');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('set_slippage').setLabel('Adjust Slippage').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('view_pk').setLabel('🔑 Export Private Key').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
        );
        await i.update({ embeds: [embed], components: [row] });
    }

    // --- SHARED ACTIONS ---
    if (i.customId === 'back_main') {
        await i.update(mainDashboard(userId));
    }

    // MODAL TRIGGERS
    if (i.customId === 'add_whale') {
        const modal = new ModalBuilder().setCustomId('whale_modal').setTitle('Monitor New Whale');
        const addr = new TextInputBuilder().setCustomId('a').setLabel("Target Address").setStyle(TextInputStyle.Short);
        const amt = new TextInputBuilder().setCustomId('m').setLabel("Max SOL per trade").setStyle(TextInputStyle.Short).setValue("0.1");
        modal.addComponents(new ActionRowBuilder().addComponents(addr), new ActionRowBuilder().addComponents(amt));
        await i.showModal(modal);
    }
});

client.login(process.env.DISCORD_TOKEN);
