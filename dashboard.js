const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getOrCreateWallet } = require('./walletManager');

// --- THE FIX: BULLETPROOF BALANCE CHECK ---
async function getBalance(pubkey) {
    const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=d6000b15-d20e-43b6-9fe1-b70692b7a70f";
    
    // We set a manual 10-second timeout for the connection
    const connection = new Connection(HELIUS_RPC, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 10000
    });

    for (let i = 0; i < 3; i++) {
        try {
            console.log(`[Attempt ${i+1}] Fetching balance for: ${pubkey}`);
            const balance = await connection.getBalance(new PublicKey(pubkey));
            return (balance / 1000000000).toFixed(3); 
        } catch (e) {
            console.error(`Balance Fetch Failed (Attempt ${i+1}):`, e.message);
            // Wait 1 second before retrying
            await new Promise(res => setTimeout(res, 1000));
        }
    }
    return "Checking..."; // If it fails 3 times, show this instead of 0.00
}

const mainDashboard = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    
    // Get the real balance
    const actualBalance = await getBalance(wallet.publicKey);

    return {
        embeds: [new EmbedBuilder()
            .setTitle('🍾 Champagne Services | Terminal')
            .setDescription(`**Wallet:** \`${wallet.publicKey}\`\n**Balance:** \`${actualBalance} SOL\``)
            .setColor('#FFD700')
            .setFooter({ text: 'Refresh by clicking any button or typing /start' })],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('menu_positions').setLabel('📈 Positions').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('menu_copytrade').setLabel('👥 Copy Trade').setStyle(ButtonStyle.Success)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('menu_withdraw').setLabel('💸 Withdraw').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('menu_settings').setLabel('⚙️ Settings').setStyle(ButtonStyle.Secondary)
            )
        ]
    };
};

module.exports = { mainDashboard };
