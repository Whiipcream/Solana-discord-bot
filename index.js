const express = require('express');
const { Client, GatewayIntentBits, InteractionType, REST, Routes } = require('discord.js');
const { startWatching } = require('./watcher'); 
const axios = require('axios'); 
require('dotenv').config();

const { mainDashboard } = require('./dashboard'); 
const { handleButtons } = require('./buttonHandler');
const { handleModals } = require('./modalHandler');

const app = express();

// --- 🟢 KEEP-ALIVE ROUTES ---
app.get('/', (req, res) => res.send('Champagne Terminal Online! 🥂'));
app.get('/ping', (req, res) => res.status(200).send('pong')); 

app.listen(process.env.PORT || 3000, '0.0.0.0');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// --- 💓 THE HEARTBEAT FUNCTION ---
function startHeartbeat() {
    const RENDER_URL = "https://solana-discord-bot-chai.onrender.com"; 
    setInterval(async () => {
        try {
            // Keep CPU "hot" so the bot responds instantly
            await axios.get(`${RENDER_URL}/ping?t=${Date.now()}`);
        } catch (e) {
            // Silently fail to keep logs clean
        }
    }, 2000); 
}

client.on('ready', async () => {
    console.log(`🚀 ${client.user.tag} is Live and breathing`);
    startHeartbeat();

    // REGISTER SLASH COMMANDS
    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        console.log("✅ Slash Commands Registered");
    } catch (e) { 
        console.error("❌ Command Registration Error:", e); 
    }

    // DELAYED WATCHER START
    const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const WSS_RPC = "wss://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const FEE_WALLET = process.env.FEE_ACCOUNT || "E1B2BHWce4JMibNSieMhcUcvpQ7BfNG4duVkQTm3o7v6";
    
    setTimeout(() => {
        try {
            startWatching(HELIUS_RPC, WSS_RPC, FEE_WALLET);
            console.log("👀 Watcher Active.");
        } catch (err) {
            console.error("❌ Watcher failed to start:", err);
        }
    }, 10000); 
});

client.on('interactionCreate', async (i) => {
    const userId = i.user.id;
    
    try {
        // --- 1. HANDLE SLASH COMMANDS ---
        if (i.isChatInputCommand() && i.commandName === 'start') {
            if (i.deferred || i.replied) return;

            await i.deferReply(); 
            const dashboardData = await mainDashboard(userId);
            
            try {
                return await i.editReply(dashboardData);
            } catch (err) {
                // If edit fails (timeout), use followUp as a backup
                console.log("⚠️ EditReply failed, sending FollowUp...");
                return await i.followUp(dashboardData);
            }
        }
        
        // --- 2. HANDLE BUTTONS ---
        if (i.isButton()) {
            // Acknowledge the button immediately to stop the "thinking" state
            if (!i.deferred && !i.replied) await i.deferUpdate().catch(() => null);
            return await handleButtons(i, userId);
        }
        
        // --- 3. HANDLE MODALS ---
        if (i.type === InteractionType.ModalSubmit) {
            return await handleModals(i, userId);
        }
    } catch (error) {
        console.error("Critical Interaction Error:", error);
        // Only attempt to reply if we haven't sent anything yet
        if (!i.replied && !i.deferred) {
            await i.reply({ content: "⚠️ System busy. Please try again.", ephemeral: true }).catch(() => null);
        }
    }
});

// --- GLOBAL ERROR CATCHERS ---
process.on('unhandledRejection', error => {
    // Silence common Discord timeout errors from flooding the console
    if (error.code === 10062 || error.code === 40060) return; 
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => console.error('Uncaught exception:', error));

client.login(process.env.DISCORD_TOKEN);
