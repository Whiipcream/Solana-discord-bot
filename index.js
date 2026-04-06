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
    
    // 1. REGISTER COMMANDS IMMEDIATELY
    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        console.log("✅ Slash Commands Registered");
    } catch (e) { 
        console.error("❌ Command Registration Error:", e); 
    }

    // 2. START WATCHER IN BACKGROUND (Prevents boot lag)
    const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const WSS_RPC = "wss://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const FEE_WALLET = process.env.FEE_ACCOUNT || "E1B2BHWce4JMibNSieMhcUcvpQ7BfNG4duVkQTm3o7v6";
    
    setTimeout(() => {
        try {
            startWatching(HELIUS_RPC, WSS_RPC, FEE_WALLET);
            console.log("👀 Watcher Active. Fee Account: " + FEE_WALLET);
        } catch (err) {
            console.error("❌ Watcher Error:", err);
        }
    }, 5000); // Wait 5 seconds after boot to start the heavy RPC work
});

client.on('interactionCreate', async (i) => {
    const userId = i.user.id;
    
    try {
        // --- HANDLE COMMANDS ---
        if (i.isChatInputCommand() && i.commandName === 'start') {
            // Tell Discord to wait (Fixes "Application did not respond")
            await i.deferReply(); 
            const dashboardData = await mainDashboard(userId);
            return await i.editReply(dashboardData);
        }
        
        // --- HANDLE BUTTONS ---
        if (i.isButton()) {
            // Some buttons might need deferUpdate if they take a long time
            return await handleButtons(i, userId);
        }
        
        // --- HANDLE MODALS ---
        if (i.type === InteractionType.ModalSubmit) {
            return await handleModals(i, userId);
        }
    } catch (error) {
        console.error("Interaction Error:", error);
        // Clean way to handle errors if we already deferred
        const errorMsg = { content: "⚠️ Something went wrong. Please try again.", ephemeral: true };
        if (i.deferred) return await i.editReply(errorMsg);
        if (!i.replied) return await i.reply(errorMsg);
    }
});

client.login(process.env.DISCORD_TOKEN);
