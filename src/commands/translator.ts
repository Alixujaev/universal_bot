import TelegramBot from 'node-telegram-bot-api';
import { languages } from '../lib/languages';
import { translateText } from '../lib/translator';

export const setTranslationLanguage = (bot: TelegramBot, chatId: number, userLanguageMap: Map<number, { code: string, name: string, flag: string }>) => {
    bot.sendMessage(chatId, 'Iltimos, qaysi tilga tarjima qilishni xohlaysiz?', createLanguageOptions());
};

export const handleTranslationCommand = (bot: TelegramBot, message: TelegramBot.Message, data: string, userLanguageMap: Map<number, { code: string, name: string, flag: string }>) => {
    const chatId = message.chat.id;
    const langCode = data.split('_')[1];
    const language = languages.find(lang => lang.code === langCode);
    if (language) {
        userLanguageMap.set(chatId, language);
        bot.sendMessage(chatId, `Tarjima tili ${language.flag} ${language.name} qilib o'rnatildi. Endi matnni kiriting.`);
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
                bot.sendMessage(chatId, `${translatedText}`, {
                    reply_to_message_id: msg.message_id
                });
            } catch (error) {
                bot.sendMessage(chatId, error.message);
            }
        } else {
            bot.sendMessage(chatId, 'Iltimos, avval tarjima tilini tanlang.', createLanguageOptions());
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
