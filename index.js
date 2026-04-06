const express = require('express'); // Fixed: lowercase 'c'
const { Client, GatewayIntentBits, InteractionType, REST, Routes } = require('discord.js');
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

app.listen(process.env.PORT || 3000, '0.0.0.0');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// --- 💓 HEARTBEAT TO PREVENT RENDER SLEEP ---
function startHeartbeat() {
    const RENDER_URL = "https://solana-discord-bot-chai.onrender.com"; 
    setInterval(async () => {
        try {
            await axios.get(`${RENDER_URL}/ping?t=${Date.now()}`);
        } catch (e) { }
    }, 2000); 
}

client.on('ready', async () => {
    console.log(`🚀 ${client.user.tag} is Live`);
    startHeartbeat();

    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
    } catch (e) { console.error("Command Error:", e); }

    const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const WSS_RPC = "wss://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    const FEE_WALLET = process.env.FEE_ACCOUNT || "E1B2BHWce4JMibNSieMhcUcvpQ7BfNG4duVkQTm3o7v6";
    
    setTimeout(() => {
        try {
            startWatching(HELIUS_RPC, WSS_RPC, FEE_WALLET);
        } catch (err) { console.error("Watcher Error:", err); }
    }, 10000); 
});

// --- 🛠️ INTERACTION HANDLER ---
client.on('interactionCreate', async (i) => {
    const userId = i.user.id;
    
    try {
        // --- 1. SLASH COMMANDS ---
        if (i.isChatInputCommand() && i.commandName === 'start') {
            if (i.deferred || i.replied) return;
            await i.deferReply(); 
            const dashboardData = await mainDashboard(userId);
            try {
                return await i.editReply(dashboardData);
            } catch (err) {
                return await i.followUp(dashboardData);
            }
        }
        
        // --- 2. BUTTONS (STABILIZED HAND-OFF) ---
        if (i.isButton()) {
            // Check if it's a Modal trigger first. Modals CANNOT be deferred.
            const modalButtons = ['add_whale', 'trigger_withdraw_modal'];
            const isModalTrigger = modalButtons.includes(i.customId) || i.customId.startsWith('set_limit_');

            if (!isModalTrigger) {
                // For all other buttons (navigation/actions), acknowledge INSTANTLY
                // This stops the "Interaction Failed" error on cold starts
                await i.deferUpdate().catch(() => null);
            }

            return await handleButtons(i, userId);
        }
        
        // --- 3. MODALS ---
        if (i.type === InteractionType.ModalSubmit) {
            return await handleModals(i, userId);
        }
    } catch (error) {
        if (error.code === 10062 || error.code === 40060) return;
        console.error("Interaction Error:", error);
    }
});

process.on('unhandledRejection', error => {
    if (error.code === 10062 || error.code === 40060) return; 
    console.error('Unhandled Rejection:', error);
});

client.login(process.env.DISCORD_TOKEN);
