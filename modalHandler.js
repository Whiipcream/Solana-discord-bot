const { addTrackedTrader, updateTraderLimit } = require('./walletManager');

async function handleModals(i, userId) {
    if (i.customId === 'whale_modal') {
        const address = i.fields.getTextInputValue('address');
        const limit = i.fields.getTextInputValue('limit');
        await addTrackedTrader(userId, address, limit);
        return await i.reply({ content: `✅ Now tracking ${address}`, ephemeral: true });
    }

    if (i.customId.startsWith('limit_modal_')) {
        const id = i.customId.split('_')[2];
        const newLimit = i.fields.getTextInputValue('new_limit');
        await updateTraderLimit(id, newLimit);
        return await i.reply({ content: `✅ Limit updated to ${newLimit} SOL`, ephemeral: true });
    }
}

module.exports = { handleModals };
