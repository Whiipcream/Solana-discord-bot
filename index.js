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
    console.log(`🚀 ${client.user.tag} is Live and breathing`);
    
    // 1. REGISTER COMMANDS IMMEDIATELY
    // We do this first so Discord knows the bot is responsive
    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        console.log("✅ Slash Commands Registered");
    } catch (e) { 
        console.error("❌ Command Registration Error:", e); 
    }

    // 2. DELAYED WATCHER START (Fixes ETIMEDOUT / ENETUNREACH)
    // We wait 10 seconds to ensure the Render instance has a stable network IP
    const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const WSS_RPC = "wss://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const FEE_WALLET = process.env.FEE_ACCOUNT || "E1B2BHWce4JMibNSieMhcUcvpQ7BfNG4duVkQTm3o7v6";
    
    setTimeout(() => {
        console.log("🔗 Connecting to Helius RPC...");
        try {
            startWatching(HELIUS_RPC, WSS_RPC, FEE_WALLET);
            console.log("👀 Watcher Active. Fee Account: " + FEE_WALLET);
        } catch (err) {
            console.error("❌ Watcher failed to start during boot:", err);
        }
    }, 10000); 
});

client.on('interactionCreate', async (i) => {
    const userId = i.user.id;
    
    try {
        // --- HANDLE COMMANDS ---
        if (i.isChatInputCommand() && i.commandName === 'start') {
            await i.deferReply(); // Mandatory for slow DB calls
            const dashboardData = await mainDashboard(userId);
            return await i.editReply(dashboardData);
        }
        
        // --- HANDLE BUTTONS ---
        if (i.isButton()) {
            // We handle the deferring inside handleButtons.js using .update() or .deferUpdate()
            return await handleButtons(i, userId);
        }
        
        // --- HANDLE MODALS ---
        if (i.type === InteractionType.ModalSubmit) {
            return await handleModals(i, userId);
        }
    } catch (error) {
        console.error("Critical Interaction Error:", error);
        const errorMsg = { content: "⚠️ System busy. Please try again in a moment.", ephemeral: true };
        
        // Safety: check if we already replied so we don't crash the bot
        if (i.deferred || i.replied) {
            return await i.followUp(errorMsg).catch(() => null);
        } else {
            return await i.reply(errorMsg).catch(() => null);
        }
    }
});

// GLOBAL ERROR HANDLING: Prevents the bot from crashing on network hiccups
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

client.login(process.env.DISCORD_TOKEN);
