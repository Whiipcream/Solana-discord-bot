const express = require('express');
const { Client, GatewayIntentBits, InteractionType, REST, Routes } = require('discord.js');
require('dotenv').config();

// --- FIXED: No /ui/ folder, just look in the main directory ---
const { mainDashboard } = require('./dashboard'); 
const { handleButtons } = require('./buttonHandler');
const { handleModals } = require('./modalHandler');

const app = express();
app.get('/', (req, res) => res.send('Champagne Terminal Online! 🥂'));
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`Heartbeat listening on port ${port}`));

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

client.on('ready', async () => {
    console.log(`🚀 ${client.user.tag} is Live`);
    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (error) { console.error('Command Error:', error); }
});

client.on('interactionCreate', async (i) => {
    const userId = i.user.id;
    try {
        if (i.isChatInputCommand() && i.commandName === 'start') {
            return await i.reply(await mainDashboard(userId));
        }
        if (i.isButton()) return await handleButtons(i, userId);
        if (i.type === InteractionType.ModalSubmit) return await handleModals(i, userId);
    } catch (err) {
        console.error('Interaction Error:', err);
    }
});

client.login(process.env.DISCORD_TOKEN);
