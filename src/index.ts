import TelegramBot from 'node-telegram-bot-api';
import { translateText } from './commands/translator';
import { languages } from './lib/languages';
import * as dotenv from 'dotenv';
dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const userLanguageMap = new Map<number, { code: string, name: string, flag: string }>();

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

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!userLanguageMap.has(chatId)) {
        bot.sendMessage(chatId, 'Tarjima botiga xush kelibsiz! Iltimos, qaysi tilga tarjima qilishni xohlaysiz?', createLanguageOptions());
    } else {
        const { name, flag } = userLanguageMap.get(chatId)!;
        bot.sendMessage(chatId, `Salom! Sizning tanlangan tarjima tilingiz: ${flag} ${name}. Matnni kiriting yoki /setlanguage buyrug'i orqali tarjima tilini o'zgartiring.`);
    }
});

bot.onText(/\/setlanguage/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Iltimos, qaysi tilga tarjima qilishni xohlaysiz?', createLanguageOptions());
});

bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;

    if (message && data) {
        const chatId = message.chat.id;

        if (data.startsWith('lang_')) {
            const langCode = data.split('_')[1];
            const language = languages.find(lang => lang.code === langCode);
            if (language) {
                userLanguageMap.set(chatId, language);
                bot.sendMessage(chatId, `Tarjima tili ${language.flag} ${language.name} qilib o'rnatildi. Endi matnni kiriting.`);
            }
        } else if (data.startsWith('page_')) {
            const page = parseInt(data.split('_')[1], 10);
            bot.editMessageText('Iltimos, qaysi tilga tarjima qilishni xohlaysiz?', {
                chat_id: chatId,
                message_id: message.message_id,
                ...createLanguageOptions(page)
            });
        }
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text && !text.startsWith('/')) {
        const targetLanguage = userLanguageMap.get(chatId);

        if (targetLanguage) {
            try {
                bot.sendChatAction(chatId, 'typing'); // Typing statusini ko'rsatish
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
});
