const express = require('express'); 
const { Client, GatewayIntentBits, InteractionType, REST, Routes, Events } = require('discord.js');
const { startWatching } = require('./watcher'); 
const axios = require('axios'); 
require('dotenv').config();

const { mainDashboard } = require('./dashboard'); 
const { handleButtons } = require('./buttonHandler');
const { handleModals } = require('./modalHandler');

const app = express();

// --- 🟢 WEB SERVER & PING ---
app.get('/', (req, res) => res.send('Champagne Terminal Online! 🥂'));
app.get('/ping', (req, res) => res.status(200).send('pong')); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`📡 Web Server listening on port ${PORT}`));

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// --- 🚀 READY EVENT ---
client.once(Events.ClientReady, async () => {
    console.log(`🚀 ${client.user.tag} is Live`);
    
    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        console.log("✅ Slash commands registered.");
    } catch (e) { console.error("Command Error:", e); }

    const HELIUS_RPC = process.env.RPC_URL || "";
    const WSS_RPC = HELIUS_RPC.replace('https://', 'wss://');
    const FEE_WALLET = process.env.FEE_ACCOUNT || "E1B2BHWce4JMibNSieMhcUcvpQ7BfNG4duVkQTm3o7v6";
    
    setTimeout(() => {
        try { startWatching(HELIUS_RPC, WSS_RPC, FEE_WALLET); } catch (err) { console.error(err); }
    }, 5000); 
});

// --- 🛠️ INTERACTION HANDLER (Traffic Controller) ---
client.on(Events.InteractionCreate, async (i) => {
    const userId = i.user.id;
    
    try {
        // 1. Slash Commands
        if (i.isChatInputCommand() && i.commandName === 'start') {
            await i.deferReply(); 
            const dashboardData = await mainDashboard(userId);
            return await i.editReply(dashboardData);
        }
        
        // 2. Buttons (Hand-off ONLY)
        if (i.isButton()) {
            return await handleButtons(i, userId);
        }
        
        // 3. Modals
        if (i.type === InteractionType.ModalSubmit) {
            // Modals take time to process DB/Chain, so we defer here
            if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true }).catch(() => null);
            return await handleModals(i, userId);
        }

    } catch (error) {
        if (error.code === 10062 || error.code === 40060) return;
        console.error("Interaction Error:", error);
    }
});

client.login(process.env.DISCORD_TOKEN);
