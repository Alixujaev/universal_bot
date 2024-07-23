"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTextMessage = exports.handleTranslationCommand = exports.setTranslationLanguage = void 0;
const languages_1 = require("../utils/languages");
const translator_1 = require("../utils/translator");
const userMessageMap = new Map();
const addMessageToContext = (chatId, messageId) => {
    const messages = userMessageMap.get(chatId) || [];
    messages.push(messageId);
    userMessageMap.set(chatId, messages);
};
const setTranslationLanguage = async (bot, chatId, userLanguageMap) => {
    const sentMessage = await bot.sendMessage(chatId, 'Iltimos, qaysi tilga tarjima qilishni xohlaysiz?', createLanguageOptions());
    addMessageToContext(chatId, sentMessage.message_id);
};
exports.setTranslationLanguage = setTranslationLanguage;
const handleTranslationCommand = async (bot, callbackQuery, data, userLanguageMap) => {
    const chatId = callbackQuery.message?.chat.id;
    const messageId = callbackQuery.message?.message_id;
    const langCode = data.split('_')[1];
    const language = languages_1.languages.find(lang => lang.code === langCode);
    if (!chatId || !messageId)
        return;
    if (language) {
        userLanguageMap.set(chatId, language);
        await bot.editMessageText(`Tarjima tili ${language.flag} ${language.name} qilib o'rnatildi. Endi matnni kiriting:\n\n/setlanguage orqali tilni o'zgartirishingiz mumkin`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [], } // Toza markup bilan
        });
    }
};
exports.handleTranslationCommand = handleTranslationCommand;
const handleTextMessage = async (bot, msg, userLanguageMap) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (text && !text.startsWith('/')) {
        const targetLanguage = userLanguageMap.get(chatId);
        if (targetLanguage) {
            try {
                bot.sendChatAction(chatId, 'typing');
                const translatedText = await (0, translator_1.translateText)(text, targetLanguage.code);
                const sentMessage = await bot.sendMessage(chatId, `${translatedText}`, {
                    reply_markup: {
                        keyboard: [
                            [{ text: "Bot turini o'zgartirish" }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    },
                    reply_to_message_id: msg.message_id
                });
                addMessageToContext(chatId, sentMessage.message_id);
            }
            catch (error) {
                const sentMessage = await bot.sendMessage(chatId, error.message, {
                    reply_markup: {
                        keyboard: [
                            [{ text: "Bot turini o'zgartirish" }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    }
                });
                addMessageToContext(chatId, sentMessage.message_id);
            }
        }
        else {
            const sentMessage = await bot.sendMessage(chatId, 'Iltimos, avval tarjima tilini tanlang.', createLanguageOptions());
            addMessageToContext(chatId, sentMessage.message_id);
        }
    }
};
exports.handleTextMessage = handleTextMessage;
const createLanguageOptions = (page = 1) => {
    const itemsPerPage = 18;
    const offset = (page - 1) * itemsPerPage;
    const paginatedLanguages = languages_1.languages.slice(offset, offset + itemsPerPage);
    const inlineKeyboard = [];
    for (let i = 0; i < paginatedLanguages.length; i += 3) {
        const row = paginatedLanguages.slice(i, i + 3).map(lang => ({
            text: `${lang.flag} ${lang.name}`,
            callback_data: `lang_${lang.code}`
        }));
        inlineKeyboard.push(row);
    }
    if (languages_1.languages.length > itemsPerPage) {
        const paginationButtons = [];
        if (page > 1) {
            paginationButtons.push({ text: '⬅️ Previous', callback_data: `page_${page - 1}` });
        }
        if (offset + itemsPerPage < languages_1.languages.length) {
            paginationButtons.push({ text: 'Next ➡️', callback_data: `page_${page + 1}` });
        }
        inlineKeyboard.push(paginationButtons);
    }
    return {
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    };
};
//# sourceMappingURL=translator.js.map