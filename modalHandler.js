const { addTrackedTrader, updateTraderLimit } = require('./walletManager');

async function handleModals(i, userId) {
    // This MUST match the CustomId in your buttonHandler
    if (i.customId === 'whale_modal') {
        const address = i.fields.getTextInputValue('address');
        const limit = i.fields.getTextInputValue('limit');
        
        try {
            await addTrackedTrader(userId, address, limit);
            return await i.reply({ 
                content: `✅ **Success!** Now tracking \`${address}\` with a \`${limit} SOL\` limit.`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Add Trader Error:', error);
            return await i.reply({ content: '❌ Failed to save trader. Check your database.', ephemeral: true });
        }
    }

    if (i.customId.startsWith('limit_modal_')) {
        const id = i.customId.split('_')[2];
        const newLimit = i.fields.getTextInputValue('new_limit');
        await updateTraderLimit(id, newLimit);
        return await i.reply({ content: `✅ Limit updated to \`${newLimit} SOL\`.`, ephemeral: true });
    }
}

module.exports = { handleModals };
