const express = require('express');
const { Client, GatewayIntentBits, InteractionType, REST, Routes } = require('discord.js');
const { mainDashboard } = require('./ui/dashboard');
const { handleButtons } = require('./buttonHandler');
const { handleModals } = require('./modalHandler');
require('dotenv').config();

const app = express();
app.get('/', (req, res) => res.send('Champagne Terminal Online! 🥂'));
app.listen(process.env.PORT || 3000, '0.0.0.0');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

client.on('ready', async () => {
    console.log(`🚀 ${client.user.tag} is Live`);
    const commands = [{ name: 'start', description: 'Launch the Champagne Terminal 🥂' }];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (error) { console.error(error); }
});

client.on('interactionCreate', async (i) => {
    const userId = i.user.id;

    if (i.isChatInputCommand() && i.commandName === 'start') {
        return await i.reply(await mainDashboard(userId));
    }

    if (i.isButton()) return await handleButtons(i, userId);

    if (i.type === InteractionType.ModalSubmit) return await handleModals(i, userId);
});

client.login(process.env.DISCORD_TOKEN);
