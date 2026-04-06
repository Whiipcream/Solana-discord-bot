const express = require('express'); 
const { Client, GatewayIntentBits, InteractionType, REST, Routes, Events } = require('discord.js');
const { startWatching } = require('./watcher'); 
const axios = require('axios'); 
require('dotenv').config();

const { mainDashboard } = require('./dashboard'); 
const { handleButtons } = require('./buttonHandler');
const { handleModals } = require('./modalHandler');

const app = express();

// --- 🟢 WEB SERVER & PING FOR RENDER ---
app.get('/', (req, res) => res.send('Champagne Terminal Online! 🥂'));
app.get('/ping', (req, res) => res.status(200).send('pong')); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`📡 Web Server listening on port ${PORT}`));

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// --- 💓 HEARTBEAT TO PREVENT RENDER SLEEP ---
function startHeartbeat() {
    const RENDER_URL = "https://solana-discord-bot-chai.onrender.com"; 
    setInterval(async () => {
        try {
            // Self-ping to keep the container from idling
            await axios.get(`${RENDER_URL}/ping?t=${Date.now()}`);
        } catch (e) { /* Silent fail is fine here */ }
    }, 30000); // Increased to 30s (2s is too aggressive for Render's free tier)
}

// --- 🚀 READY EVENT ---
client.once(Events.ClientReady, async () => {
    console.log(`🚀 ${client.user.tag} is Live`);
    startHeartbeat();

    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        console.log("✅ Slash commands registered.");
    } catch (e) { 
        console.error("Command Error:", e); 
    }

    // RPC Configuration
    const HELIUS_RPC = process.env.RPC_URL || "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const WSS_RPC = HELIUS_RPC.replace('https', 'wss');
    const FEE_WALLET = process.env.FEE_ACCOUNT || "E1B2BHWce4JMibNSieMhcUcvpQ7BfNG4duVkQTm3o7v6";
    
    // Delayed start for the blockchain watcher to ensure DB is ready
    setTimeout(() => {
        try {
            console.log("🔍 Champagne Watcher: Monitoring Blockchain via Helius...");
            startWatching(HELIUS_RPC, WSS_RPC, FEE_WALLET);
        } catch (err) { 
            console.error("Watcher Error:", err); 
        }
    }, 5000); 
});

// --- 🛠️ INTERACTION HANDLER ---
client.on(Events.InteractionCreate, async (i) => {
    const userId = i.user.id;
    
    try {
        // --- 1. SLASH COMMANDS ---
        if (i.isChatInputCommand() && i.commandName === 'start') {
            await i.deferReply(); 
            const dashboardData = await mainDashboard(userId);
            return await i.editReply(dashboardData);
        }
        
        // --- 2. BUTTON HANDLER ---
        if (i.isButton()) {
            // Define buttons that trigger Modals. 
            // ⚠️ DO NOT DEFER THESE. Discord crashes if you defer before showing a Modal.
            const modalButtons = ['add_whale', 'trigger_withdraw_modal'];
            const isModalTrigger = modalButtons.includes(i.customId) || i.customId.startsWith('set_limit_');

            if (!isModalTrigger) {
                // ALL OTHER BUTTONS (Menus, Explore, Back, etc.)
                // We defer immediately to prevent "Interaction Failed" while fetching Birdeye data.
                await i.deferUpdate().catch(() => null);
            }

            // Hand-off to buttonHandler.js
            return await handleButtons(i, userId);
        }
        
        // --- 3. MODAL SUBMISSIONS ---
        if (i.type === InteractionType.ModalSubmit) {
            // Modals usually take time to process (database/blockchain), so we defer.
            await i.deferReply({ ephemeral: true }).catch(() => null);
            return await handleModals(i, userId);
        }

    } catch (error) {
        // Ignore "Unknown Interaction" errors caused by network lag or duplicate clicks
        if (error.code === 10062 || error.code === 40060) return;
        console.error("Interaction Error:", error);
    }
});

// Global Error Handling to keep the bot from crashing on Render
process.on('unhandledRejection', error => {
    if (error.code === 10062 || error.code === 40060) return; 
    console.error('Unhandled Rejection:', error);
});

client.login(process.env.DISCORD_TOKEN);
