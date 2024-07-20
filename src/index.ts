import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import { handleTranslationCommand, setTranslationLanguage, handleTextMessage } from './commands/translator';
import { handleDownloadCommand, handleMediaUrl } from './commands/downloader';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const userLanguageMap = new Map<number, { code: string, name: string, flag: string }>();

const mainMenuOptions = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: 'Tarjima', callback_data: 'translate' },
                { text: 'Yuklash', callback_data: 'download' }
            ]
        ]
    }
};

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Universal botga xush kelibsiz! Quyidagi menyudan tanlang:', mainMenuOptions);
});

bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;

    if (message && data) {
        const chatId = message.chat.id;

        if (data === 'translate') {
            setTranslationLanguage(bot, chatId, userLanguageMap);
        } else if (data === 'download') {
            handleDownloadCommand(bot, chatId);
        } else if (data.startsWith('lang_')) {
            handleTranslationCommand(bot, message, data, userLanguageMap);
        }
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (msg.text) {
        if (text.startsWith('/')) {
            return;
        }

        if (userLanguageMap.has(chatId)) {
            await handleTextMessage(bot, msg, userLanguageMap);
        } else {
            bot.sendMessage(chatId, 'Iltimos, avval tarjima tilini tanlang.', setTranslationLanguage(bot, chatId, userLanguageMap));
        }
    }
});
