"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = exports.addMessageToContext = exports.clearPreviousMessages = exports.mainMenuOptions = void 0;
const systemLangs_1 = require("./systemLangs");
const userMessageMap = new Map();
const mainMenuOptions = (chatId) => {
    const translate = (text) => (0, systemLangs_1.translateMessage)(chatId, text);
    return {
        reply_markup: {
            keyboard: [
                [{ text: translate('Translation') }, { text: translate('Download') }],
                [{ text: translate('Currency Calculator') }, { text: translate('File Conversion') }]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        },
    };
};
exports.mainMenuOptions = mainMenuOptions;
const clearPreviousMessages = async (chatId, bot) => {
    const messages = userMessageMap.get(chatId) || [];
    for (const messageId of messages) {
        try {
            await bot.deleteMessage(chatId, String(messageId));
        }
        catch (error) {
            console.error('Error deleting message:', error);
        }
    }
    userMessageMap.set(chatId, []);
};
exports.clearPreviousMessages = clearPreviousMessages;
const addMessageToContext = (chatId, messageId) => {
    const messages = userMessageMap.get(chatId) || [];
    messages.push(messageId);
    userMessageMap.set(chatId, messages);
};
exports.addMessageToContext = addMessageToContext;
const sendMessage = async (chatId, bot, text, options) => {
    const translatedText = (0, systemLangs_1.translateMessage)(chatId, text);
    const message = await bot.sendMessage(chatId, translatedText, options);
    (0, exports.addMessageToContext)(chatId, message.message_id);
};
exports.sendMessage = sendMessage;
//# sourceMappingURL=mainMenu.js.map