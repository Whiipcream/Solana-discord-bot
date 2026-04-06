const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { mainDashboard } = require('./dashboard'); 
const { getTrackedTraders, toggleTraderStatus, deleteTrader, getOrCreateWallet, addTrackedTrader, getTopTradersFeed } = require('./walletManager');

async function handleButtons(i, userId) {
    try {
        const cid = i.customId;

        // --- 1. MODAL TRIGGERS ---
        if (cid === 'add_whale' || cid === 'trigger_withdraw_modal' || cid.startsWith('set_limit_')) {
            const modal = new ModalBuilder();
            
            if (cid === 'add_whale') {
                modal.setCustomId('whale_modal').setTitle('Add Target');
                const addr = new TextInputBuilder().setCustomId('address').setLabel("Wallet Address").setStyle(TextInputStyle.Short).setRequired(true);
                const lim = new TextInputBuilder().setCustomId('limit').setLabel("Max SOL Limit").setStyle(TextInputStyle.Short).setValue("0.1").setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(addr), new ActionRowBuilder().addComponents(lim));
            } else if (cid === 'trigger_withdraw_modal') {
                modal.setCustomId('withdraw_modal').setTitle('Withdraw SOL');
                const addr = new TextInputBuilder().setCustomId('address').setLabel("Destination Address").setStyle(TextInputStyle.Short).setRequired(true);
                const amt = new TextInputBuilder().setCustomId('amount').setLabel("Amount").setStyle(TextInputStyle.Short).setPlaceholder("0.1").setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(addr), new ActionRowBuilder().addComponents(amt));
            } else if (cid.startsWith('set_limit_')) {
                const id = cid.split('_')[2];
                modal.setCustomId(`limit_modal_${id}`).setTitle('Update Limit');
                const input = new TextInputBuilder().setCustomId('new_limit').setLabel("Max SOL").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
            }
            
            return await i.showModal(modal);
        }

        // --- 2. NAVIGATION & MENUS ---
        
        if (cid === 'back_main') {
            const dashboardData = await mainDashboard(userId);
            return await i.editReply(dashboardData);
        }

        // 🟢 NEW: DISCOVERY MENU (Live Feed)
        if (cid === 'menu_discovery') {
            const traders = await getTopTradersFeed();
            const embed = new EmbedBuilder()
                .setTitle('🔥 Live Top Traders (24h)')
                .setDescription('High-profit wallets identified via Birdeye. Click to Copy.')
                .setColor('#00ffcc');

            const rows = traders.slice(0, 4).map((t, idx) => {
                const addr = t.address;
                embed.addFields({ 
                    name: `#${idx + 1} | ${addr.slice(0,6)}...`, 
                    value: `PnL: +$${t.pnl.toFixed(2)} | ROI: ${t.pnl_percent.toFixed(1)}%`,
                    inline: true 
                });
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`quick_copy_${addr}`).setLabel(`Copy #${idx + 1}`).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setLabel('Solscan').setURL(`https://solscan.io/account/${addr}`).setStyle(ButtonStyle.Link)
                );
            });

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            ));

            return await i.editReply({ embeds: [embed], components: rows });
        }

        // 🟢 NEW: QUICK COPY LOGIC
        if (cid.startsWith('quick_copy_')) {
            const targetAddress = cid.split('_')[2];
            await addTrackedTrader(userId, targetAddress, "0.1"); // Safe default limit
            return await i.editReply({ 
                content: `✅ Successfully following \`${targetAddress}\`!`, 
                embeds: [], 
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('menu_copytrade').setLabel('View My Traders').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('back_main').setLabel('Main Menu').setStyle(ButtonStyle.Secondary)
                )]
            });
        }

        if (cid === 'menu_positions') {
            const wallet = await getOrCreateWallet(userId);
            const embed = new EmbedBuilder()
                .setTitle('📈 Your Positions')
                .setDescription(`**Total Value:** ${wallet.totalUsd}\n*Live token tracking active.*`)
                .setColor('#5865F2');
            const rows = [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sell_25').setLabel('Sell 25%').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('sell_all').setLabel('Sell All').setStyle(ButtonStyle.Danger)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
                )
            ];
            return await i.editReply({ embeds: [embed], components: rows });
        }

        if (cid === 'menu_withdraw') {
            const wallet = await getOrCreateWallet(userId);
            const embed = new EmbedBuilder()
                .setTitle('💸 Withdraw Funds')
                .setDescription(`**Available Balance:** \`${wallet.solBalance} SOL\`\n**From Bot Wallet:** \`${wallet.publicKey}\``)
                .setColor('#e74c3c');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_withdraw_modal').setLabel('Withdraw to Wallet').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            );
            return await i.editReply({ embeds: [embed], components: [row] });
        }

        if (cid === 'menu_copytrade') {
            const traders = await getTrackedTraders(userId);
            const embed = new EmbedBuilder().setTitle('👥 Copy Trade Settings').setColor('#2ecc71')
                .setDescription(traders.length > 0 ? 'Select a wallet to manage.' : 'No targets yet.');

            const rows = traders.slice(0, 4).map(t => new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`manage_trader_${t.id}`)
                    .setLabel(`${t.status === 'active' ? '🟢' : '⏸️'} ${t.trader_address.slice(0,6)}... (${t.trade_limit} SOL)`)
                    .setStyle(ButtonStyle.Primary)
            ));

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_whale').setLabel('➕ Add Target').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            ));
            return await i.editReply({ embeds: [embed], components: rows });
        }

        if (cid === 'menu_settings') {
            const embed = new EmbedBuilder()
                .setTitle('⚙️ Terminal Settings')
                .setDescription('**Priority Fee:** `0.001 SOL`\n**Slippage:** `10%`\n**Auto-Confirm:** `Enabled`')
                .setColor('#95a5a6');
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            );

            return await i.editReply({ embeds: [embed], components: [row] });
        }

        // --- 3. ACTIONS ---
        if (cid.startsWith('manage_trader_')) {
            const id = cid.split('_')[2];
            const embed = new EmbedBuilder().setTitle('⚙️ Manage Trader').setDescription(`Settings for Target ID: ${id}`).setColor('#f1c40f');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`pause_${id}`).setLabel('⏸️ Pause/Resume').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`remove_${id}`).setLabel('🗑️ Remove').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('menu_copytrade').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            );
            return await i.editReply({ embeds: [embed], components: [row] });
        }

        if (cid.startsWith('pause_') || cid.startsWith('remove_')) {
            const id = cid.split('_')[1];
            if (cid.startsWith('pause_')) await toggleTraderStatus(id);
            if (cid.startsWith('remove_')) await deleteTrader(id);
            
            const traders = await getTrackedTraders(userId);
            const embed = new EmbedBuilder().setTitle('👥 Copy Trade Settings').setColor('#2ecc71')
                .setDescription('✅ List Updated.');
            
            return await i.editReply({ embeds: [embed] }); 
        }

    } catch (error) {
        console.error("Button Execution Error:", error);
        try {
            if (i.deferred || i.replied) {
                await i.editReply({ content: "⚠️ System delay. Please try again." });
            } else {
                await i.reply({ content: "⚠️ System delay. Please try again.", ephemeral: true });
            }
        } catch (e) {}
    }
}

module.exports = { handleButtons };
