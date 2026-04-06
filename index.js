const express = require('express');
const { Client, GatewayIntentBits, InteractionType, REST, Routes } = require('discord.js');
const { startWatching } = require('./watcher'); // New Import
require('dotenv').config();

const { mainDashboard } = require('./dashboard'); 
const { handleButtons } = require('./buttonHandler');
const { handleModals } = require('./modalHandler');

const app = express();
app.get('/', (req, res) => res.send('Champagne Terminal Online! 🥂'));
app.listen(process.env.PORT || 3000, '0.0.0.0');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.on('ready', async () => {
    console.log(`🚀 ${client.user.tag} is Live`);
    
    // START THE TRADE WATCHER
    const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const WSS_RPC = "wss://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const FEE_WALLET = "YOUR_JUPITER_FEE_ACCOUNT_HERE"; // Replace with your referral pubkey
    
    startWatching(HELIUS_RPC, WSS_RPC, FEE_WALLET);

    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    const userId = i.user.id;
    if (i.isChatInputCommand() && i.commandName === 'start') return await i.reply(await mainDashboard(userId));
    if (i.isButton()) return await handleButtons(i, userId);
    if (i.type === InteractionType.ModalSubmit) return await handleModals(i, userId);
});

client.login(process.env.DISCORD_TOKEN);
