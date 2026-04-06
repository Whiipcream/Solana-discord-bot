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
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "https://solana-discord-bot-chai.onrender.com"; 
    setInterval(async () => {
        try {
            await axios.get(`${RENDER_URL}/ping?t=${Date.now()}`);
        } catch (e) { /* Silent fail */ }
    }, 30000); 
}

// --- 🚀 READY EVENT ---
client.once(Events.ClientReady, async () => {
    console.log(`🚀 ${client.user.tag} is Live`);
    startHeartbeat();

    // Register Commands
    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        console.log("✅ Slash commands registered.");
    } catch (e) { 
        console.error("Command Error:", e); 
    }

    // RPC & WSS Configuration
    const HELIUS_RPC = process.env.RPC_URL || "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    
    // Ensure WSS uses the correct protocol replacement
    const WSS_RPC = HELIUS_RPC.replace('https://', 'wss://');
    const FEE_WALLET = process.env.FEE_ACCOUNT || "E1B2BHWce4JMibNSieMhcUcvpQ7BfNG4duVkQTm3o7v6";
    
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
            // Modal triggers: Do NOT defer
            const modalButtons = ['add_whale', 'trigger_withdraw_modal'];
            const isModalTrigger = modalButtons.includes(i.customId) || i.customId.startsWith('set_limit_');

            if (!isModalTrigger) {
                // Defer all data-fetching buttons (Explore, Refresh, etc.)
                if (!i.deferred && !i.replied) {
                    await i.deferUpdate().catch(() => null);
                }
            }

            return await handleButtons(i, userId);
        }
        
        // --- 3. MODAL SUBMISSIONS ---
        if (i.type === InteractionType.ModalSubmit) {
            // We use ephemeral: true so the "processing" message is private
            if (!i.deferred && !i.replied) {
                await i.deferReply({ ephemeral: true }).catch(() => null);
            }
            return await handleModals(i, userId);
        }

    } catch (error) {
        if (error.code === 10062 || error.code === 40060) return;
        console.error("Interaction Error:", error);
    }
});

// --- 🛡️ CRASH PREVENTION ---
process.on('unhandledRejection', error => {
    if (error.code === 10062 || error.code === 40060) return; 
    console.error('Unhandled Rejection:', error);
});

client.login(process.env.DISCORD_TOKEN);
