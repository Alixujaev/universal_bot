import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { languages } from '../utils/languages';
import { translateMessage } from '../utils/systemLangs';
import { user } from '..';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;


export const setTranslationLanguage = async (bot: TelegramBot, chatId: number,) => {
    await bot.sendMessage(chatId, translateMessage(user.language.code, 'What language would you like to translate into?'), createLanguageOptions());
};

export const handleTranslationCommand = async (bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery, data: string, userLangsMap: Map<number, { code: string, name: string, flag: string }>) => {
    const chatId = callbackQuery.message?.chat.id;
    const messageId = callbackQuery.message?.message_id;
    const langCode = data.split('_')[1];
    const language = languages.find(lang => lang.code === langCode);

    if (!chatId || !messageId) return;



    if (language) {
        userLangsMap.set(chatId, language);
        
        await bot.editMessageText(translateMessage(chatId, `Translation language is set to {flag} {name}. Now you can change the language by typing:\n\n/setlanguage`, {
            flag: language.flag,
            name: language.name
        }), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [], } // Toza markup bilan
        })
    }
};

export const handleTextMessage = async (bot: TelegramBot, msg: TelegramBot.Message, userLangsMap: Map<number, { code: string, name: string, flag: string }>) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    

    if (text && !text.startsWith('/')) {
        const targetLanguage = userLangsMap.get(chatId);

        if (targetLanguage) {
            try {
                bot.sendChatAction(chatId, 'typing');
                const translatedText = await translateText(text, targetLanguage.code);
                await bot.sendMessage(chatId, `${translatedText}`, {
                    reply_markup: {
                        keyboard: [
                            [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    },
                    reply_to_message_id: msg.message_id
                });
            } catch (error) {
                await bot.sendMessage(chatId, error.message, {
                    reply_markup: {
                        keyboard: [
                            [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    }
                });
            }
        } else {
            await bot.sendMessage(chatId, 'Iltimos, avval tarjima tilini tanlang.', createLanguageOptions());
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

export async function translateText(text: string, targetLanguage: string): Promise<string> {
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
        const response = await axios.request(options);
        return response.data.data.translations.translatedText;
    } catch (error) {
        console.error('Error translating text:', error);
        throw new Error('Translation failed');
    }
}
