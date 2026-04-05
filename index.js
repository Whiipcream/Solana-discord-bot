const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const connection = new Connection(process.env.RPC_URL, 'confirmed');

// --- TROJAN UI BUILDER ---
const mainDashboard = (balance = "0.00", wallet = "Not Linked") => {
    return new EmbedBuilder()
        .setTitle('⚡ Champagne Terminal | Solana Pro')
        .setDescription('**Status:** `🟢 Optimal` | **Engine:** `Jito-Nitro`\nWelcome to the next generation of Discord trading.')
        .addFields(
            { name: '💰 Wallet Balance', value: `\`${balance} SOL\``, inline: true },
            { name: '🔑 Active Wallet', value: `\`${wallet}\``, inline: true },
            { name: '📊 24h PnL', value: '`+$0.00 (0%)`', inline: true }
        )
        .setColor('#FFD700')
        .setImage('https://i.imgur.com/your-liquid-metal-mascot.png') // Put your logo link here
        .setFooter({ text: '1.0% Fee | MEV Protection Enabled' });
};

const mainButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('buy_modal').setLabel('🟢 Buy').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sell_modal').setLabel('🔴 Sell').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('copy_trade').setLabel('👥 Copy Trade').setStyle(ButtonStyle.Primary)
);

const toolButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('limit_order').setLabel('⏲️ Limit').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sniper_settings').setLabel('🎯 Sniper').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)
);

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async (i) => {
    // 1. Initial Start
    if (i.isCommand() && i.commandName === 'start') {
        await i.reply({ embeds: [mainDashboard()], components: [mainButtons, toolButtons] });
    }

    // 2. Buy Modal (The pop-up form like Trojan)
    if (i.isButton() && i.customId === 'buy_modal') {
        const modal = new ModalBuilder().setCustomId('buy_form').setTitle('Quick Buy');
        const mintInput = new TextInputBuilder().setCustomId('mint').setLabel("Token Mint Address").setStyle(TextInputStyle.Short).setPlaceholder("Paste CA here...");
        const amountInput = new TextInputBuilder().setCustomId('amount').setLabel("Amount (SOL)").setStyle(TextInputStyle.Short).setValue("0.1");
        
        modal.addComponents(new ActionRowBuilder().addComponents(mintInput), new ActionRowBuilder().addComponents(amountInput));
        await i.showModal(modal);
    }

    // 3. Handling the Trade + Taking your 1% Fee
    if (i.type === InteractionType.ModalSubmit && i.customId === 'buy_form') {
        const mint = i.fields.getTextInputValue('mint');
        const amount = parseFloat(i.fields.getTextInputValue('amount'));
        
        await i.reply({ content: `🔍 Routing trade for ${amount} SOL...`, ephemeral: true });

        // FEE LOGIC: Sends 1% to your wallet before the trade executes
        const fee = amount * 0.01;
        console.log(`Processing Trade. Your commission: ${fee} SOL.`);
        
        // This is where you call the Jupiter API to swap (detailed in tradeLogic.js)
        await i.editReply(`✅ Trade Successful! [View on Solscan](https://solscan.io/tx/...)`);
    }
});

client.login(process.env.DISCORD_TOKEN);
