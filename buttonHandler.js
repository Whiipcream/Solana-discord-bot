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
            }
            
            return await i.showModal(modal);
        }

        // --- 2. DEFER UPDATE ---
        if (!i.deferred && !i.replied) await i.deferUpdate();

        // --- 3. NAVIGATION & MENUS ---
        
        if (cid === 'back_main') {
            const dashboardData = await mainDashboard(userId);
            return await i.editReply(dashboardData);
        }

        // 🟢 UPDATED: DISCOVERY MENU (DexScreener Trending)
        if (cid === 'menu_discovery') {
            const tokens = await getTopTradersFeed();
            
            if (!tokens || tokens.length === 0) {
                return await i.editReply({ content: "⚠️ No trending tokens found. Check RPC Connection.", components: [
                    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary))
                ]});
            }

            const embed = new EmbedBuilder()
                .setTitle('🚀 Trending on Solana (DexScreener)')
                .setDescription('Top active pairs right now. Click to Track/Buy.')
                .setColor('#00ffcc');

            const rows = tokens.map((t, idx) => {
                embed.addFields({ 
                    name: `${t.symbol} | $${parseFloat(t.price).toFixed(4)}`, 
                    value: `24h: ${t.pnl_percent > 0 ? '🟢' : '🔴'} ${t.pnl_percent}%`,
                    inline: true 
                });

                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`quick_copy_${t.address}`).setLabel(`Track ${t.symbol}`).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setLabel('Chart').setURL(`https://dexscreener.com/solana/${t.address}`).setStyle(ButtonStyle.Link)
                );
            });

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('back_main').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary)
            ));

            return await i.editReply({ embeds: [embed], components: rows });
        }

        // 🟢 QUICK COPY / TRACK LOGIC
        if (cid.startsWith('quick_copy_')) {
            const targetAddress = cid.split('_')[2];
            // In the new logic, we add the TOKEN address to your tracker
            await addTrackedTrader(userId, targetAddress, "0.1");
            return await i.editReply({ 
                content: `✅ Now tracking token: \`${targetAddress}\`!`, 
                embeds: [], 
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('menu_copytrade').setLabel('View My Targets').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('back_main').setLabel('Main Menu').setStyle(ButtonStyle.Secondary)
                )]
            });
        }

        // --- REMAINDER OF YOUR CODE (Positions, Withdraw, Settings) ---
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
            const embed = new EmbedBuilder().setTitle('👥 Tracked Wallets/Tokens').setColor('#2ecc71')
                .setDescription(traders.length > 0 ? 'Select a target to manage.' : 'No targets yet.');

            const rows = traders.slice(0, 3).map(t => new ActionRowBuilder().addComponents(
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

        // --- TRADER ACTIONS ---
        if (cid.startsWith('manage_trader_')) {
            const id = cid.split('_')[2];
            const embed = new EmbedBuilder().setTitle('⚙️ Manage Target').setDescription(`Settings for ID: ${id}`).setColor('#f1c40f');
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
            
            const embed = new EmbedBuilder().setTitle('👥 Target Updated').setColor('#2ecc71')
                .setDescription('✅ Target successfully updated.');
            
            return await i.editReply({ embeds: [embed], components: [
                new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_copytrade').setLabel('Back to List').setStyle(ButtonStyle.Primary))
            ]}); 
        }

    } catch (error) {
        console.error("Button Execution Error:", error);
    }
}

module.exports = { handleButtons };
