"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTextMessage = exports.handleTranslationCommand = exports.setTranslationLanguage = void 0;
exports.translateText = translateText;
const axios_1 = __importDefault(require("axios"));
const languages_1 = require("../utils/languages");
const systemLangs_1 = require("../utils/systemLangs");
const userMessageMap = new Map();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const addMessageToContext = (chatId, messageId) => {
    const messages = userMessageMap.get(chatId) || [];
    messages.push(messageId);
    userMessageMap.set(chatId, messages);
};
const setTranslationLanguage = async (bot, chatId) => {
    const sentMessage = await bot.sendMessage(chatId, (0, systemLangs_1.translateMessage)(chatId, 'What language would you like to translate into?'), createLanguageOptions());
    addMessageToContext(chatId, sentMessage.message_id);
};
exports.setTranslationLanguage = setTranslationLanguage;
const handleTranslationCommand = async (bot, callbackQuery, data, userLangsMap) => {
    const chatId = callbackQuery.message?.chat.id;
    const messageId = callbackQuery.message?.message_id;
    const langCode = data.split('_')[1];
    const language = languages_1.languages.find(lang => lang.code === langCode);
    if (!chatId || !messageId)
        return;
    if (language) {
        userLangsMap.set(chatId, language);
        await bot.editMessageText((0, systemLangs_1.translateMessage)(chatId, `Translation language is set to {flag} {name}. Now you can change the language by typing:\n\n/setlanguage`, {
            flag: language.flag,
            name: language.name
        }), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [], } // Toza markup bilan
        });
    }
};
exports.handleTranslationCommand = handleTranslationCommand;
const handleTextMessage = async (bot, msg, userLangsMap) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (text && !text.startsWith('/')) {
        const targetLanguage = userLangsMap.get(chatId);
        if (targetLanguage) {
            try {
                bot.sendChatAction(chatId, 'typing');
                const translatedText = await translateText(text, targetLanguage.code);
                const sentMessage = await bot.sendMessage(chatId, `${translatedText}`, {
                    reply_markup: {
                        keyboard: [
                            [{ text: (0, systemLangs_1.getUserLanguage)(chatId) === 'uz' ? 'Bot turini o\'zgartirish' : (0, systemLangs_1.getUserLanguage)(chatId) === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
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
                            [{ text: (0, systemLangs_1.getUserLanguage)(chatId) === 'uz' ? 'Bot turini o\'zgartirish' : (0, systemLangs_1.getUserLanguage)(chatId) === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
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
async function translateText(text, targetLanguage) {
    console.log(`Translating text: ${text} to ${targetLanguage}`);
    const options = {
        method: 'POST',
        url: 'https://deep-translate1.p.rapidapi.com/language/translate/v2',
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'deep-translate1.p.rapidapi.com',
            'Content-Type': 'application/json'
        },
        data: {
            q: text,
            source: 'auto',
            target: targetLanguage
        }
    };
    try {
        const response = await axios_1.default.request(options);
        return response.data.data.translations.translatedText;
    }
    catch (error) {
        console.error('Error translating text:', error);
        throw new Error('Translation failed');
    }
}
//# sourceMappingURL=translator.js.map