const express = require('express'); 
const { Client, GatewayIntentBits, InteractionType, REST, Routes, Events } = require('discord.js');
const { startWatching } = require('./watcher'); 
const axios = require('axios'); 
require('dotenv').config();

const { mainDashboard } = require('./dashboard'); 
const { handleButtons } = require('./buttonHandler');
const { handleModals } = require('./modalHandler');

const app = express();
app.get('/', (req, res) => res.send('Champagne Terminal Online! 🥂'));
app.get('/ping', (req, res) => res.status(200).send('pong')); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`📡 Web Server listening on port ${PORT}`));

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

client.once(Events.ClientReady, async () => {
    console.log(`🚀 ${client.user.tag} is Live`);
    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
    } catch (e) { console.error(e); }

    const RPC = process.env.RPC_URL || "";
    const WSS = RPC.replace('https://', 'wss://');
    setTimeout(() => {
        try { startWatching(RPC, WSS, process.env.FEE_ACCOUNT); } catch (err) { console.error(err); }
    }, 5000); 
});

client.on(Events.InteractionCreate, async (i) => {
    const userId = i.user.id;
    try {
        if (i.isChatInputCommand() && i.commandName === 'start') {
            await i.deferReply(); 
            const dashboardData = await mainDashboard(userId);
            return await i.editReply(dashboardData);
        }
        
        if (i.isButton()) {
            // HAND-OFF ONLY: No deferUpdate here to prevent 40060
            return await handleButtons(i, userId);
        }
        
        if (i.type === InteractionType.ModalSubmit) {
            if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
            return await handleModals(i, userId);
        }
    } catch (error) {
        if (error.code === 10062 || error.code === 40060) return;
        console.error("Interaction Error:", error);
    }
});

client.login(process.env.DISCORD_TOKEN);
