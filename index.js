const express = require('express');
const { Client, GatewayIntentBits, InteractionType, REST, Routes } = require('discord.js');
const { startWatching } = require('./watcher'); 
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
    
    // --- CONFIGURATION ---
    // We use your Helius RPC and the Fee Account you just created
    const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const WSS_RPC = "wss://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    
    // This looks for 'FEE_ACCOUNT' on Render, otherwise uses your new key
    const FEE_WALLET = process.env.FEE_ACCOUNT || "E1B2BHWce4JMibNSieMhcUcvpQ7BfNG4duVkQTm3o7v6";
    
    // START THE TRADE WATCHER (The Engine)
    try {
        startWatching(HELIUS_RPC, WSS_RPC, FEE_WALLET);
        console.log("👀 Watcher started successfully with Fee Account: " + FEE_WALLET);
    } catch (err) {
        console.error("❌ Failed to start Watcher:", err);
    }

    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
    } catch (e) { 
        console.error(e); 
    }
});

client.on('interactionCreate', async (i) => {
    const userId = i.user.id;
    
    try {
        if (i.isChatInputCommand() && i.commandName === 'start') {
            return await i.reply(await mainDashboard(userId));
        }
        
        if (i.isButton()) {
            return await handleButtons(i, userId);
        }
        
        if (i.type === InteractionType.ModalSubmit) {
            return await handleModals(i, userId);
        }
    } catch (error) {
        console.error("Interaction Error:", error);
        if (!i.replied && !i.deferred) {
            await i.reply({ content: "An error occurred while processing your request.", ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
