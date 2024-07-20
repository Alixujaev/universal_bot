import TelegramBot from 'node-telegram-bot-api';
import { languages } from '../utils/languages';
import { translateText } from '../utils/translator';

const userMessageMap = new Map<number, number[]>();

const addMessageToContext = (chatId: number, messageId: number) => {
    const messages = userMessageMap.get(chatId) || [];
    messages.push(messageId);
    userMessageMap.set(chatId, messages);
};

export const setTranslationLanguage = async (bot: TelegramBot, chatId: number, userLanguageMap: Map<number, { code: string, name: string, flag: string }>) => {
    const sentMessage = await bot.sendMessage(chatId, 'Iltimos, qaysi tilga tarjima qilishni xohlaysiz?', createLanguageOptions());
    addMessageToContext(chatId, sentMessage.message_id);
};

export const handleTranslationCommand = async (bot: TelegramBot, message: TelegramBot.Message, data: string, userLanguageMap: Map<number, { code: string, name: string, flag: string }>) => {
    const chatId = message.chat.id;
    const langCode = data.split('_')[1];
    const language = languages.find(lang => lang.code === langCode);
    if (language) {
        userLanguageMap.set(chatId, language);
        const sentMessage = await bot.sendMessage(chatId, `Tarjima tili ${language.flag} ${language.name} qilib o'rnatildi. Endi matnni kiriting.`, {
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
};

export const handleTextMessage = async (bot: TelegramBot, msg: TelegramBot.Message, userLanguageMap: Map<number, { code: string, name: string, flag: string }>) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text && !text.startsWith('/')) {
        const targetLanguage = userLanguageMap.get(chatId);

        if (targetLanguage) {
            try {
                bot.sendChatAction(chatId, 'typing');
                const translatedText = await translateText(text, targetLanguage.code);
                const sentMessage = await bot.sendMessage(chatId, `Tarjima: ${translatedText}`, {
                    reply_markup: {
                        keyboard: [
                            [{ text: "Bot turini o'zgartirish" }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    }
                });
                addMessageToContext(chatId, sentMessage.message_id);
            } catch (error) {
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
        } else {
            const sentMessage = await bot.sendMessage(chatId, 'Iltimos, avval tarjima tilini tanlang.', createLanguageOptions());
            addMessageToContext(chatId, sentMessage.message_id);
        }
    }
};

const createLanguageOptions = (page: number = 1) => {
    const itemsPerPage = 18;
    const offset = (page - 1) * itemsPerPage;
    const paginatedLanguages = languages.slice(offset, offset + itemsPerPage);

    const inlineKeyboard = [];
    for (let i = 0; i < paginatedLanguages.length; i += 3) {
        const row = paginatedLanguages.slice(i, i + 3).map(lang => ({
            text: `${lang.flag} ${lang.name}`,
            callback_data: `lang_${lang.code}`
        }));
        inlineKeyboard.push(row);
    }

    if (languages.length > itemsPerPage) {
        const paginationButtons = [];
        if (page > 1) {
            paginationButtons.push({ text: '⬅️ Previous', callback_data: `page_${page - 1}` });
        }
        if (offset + itemsPerPage < languages.length) {
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
