import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import { handleTranslationCommand, setTranslationLanguage, handleTextMessage } from './commands/translator';
import { handleDownloadCommand, handleMediaUrl } from './commands/downloader';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const userContextMap = new Map<number, string>();
const userLanguageMap = new Map<number, { code: string, name: string, flag: string }>();
const userMessageMap = new Map<number, number[]>();

const mainMenuOptions = {
    reply_markup: {
        keyboard: [
            [{ text: 'Tarjima' }, { text: 'Yuklash' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

const clearPreviousMessages = async (chatId: number) => {
    const messages = userMessageMap.get(chatId) || [];
    for (const messageId of messages) {
        try {
            await bot.deleteMessage(chatId, String(messageId));
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    }
    userMessageMap.set(chatId, []);
};

const addMessageToContext = (chatId: number, messageId: number) => {
    const messages = userMessageMap.get(chatId) || [];
    messages.push(messageId);
    userMessageMap.set(chatId, messages);
};

bot.onText(/\/start/, async (msg) => {
    userContextMap.set(msg.chat.id, 'main');
    await clearPreviousMessages(msg.chat.id);
    const sentMessage = await bot.sendMessage(msg.chat.id, 'Universal botga xush kelibsiz! Quyidagi menyudan tanlang:', mainMenuOptions);
    addMessageToContext(msg.chat.id, sentMessage.message_id);
});

bot.onText(/Bot turini o'zgartirish/, async (msg) => {
    await clearPreviousMessages(msg.chat.id);
    const sentMessage = await bot.sendMessage(msg.chat.id, 'Quyidagi menyudan tanlang:', mainMenuOptions);
    addMessageToContext(msg.chat.id, sentMessage.message_id);
});

bot.onText(/Tarjima/, async (msg) => {
    const chatId = msg.chat.id;
    userContextMap.set(chatId, 'translate');
    await clearPreviousMessages(chatId);
    const infoMessage = await bot.sendMessage(chatId, 'Siz tarjima botini tanladingiz. Bu yerda siz textlarni tarjima qilishingiz mumkin.');
    addMessageToContext(chatId, infoMessage.message_id);
    setTranslationLanguage(bot, chatId, userLanguageMap);
});

bot.onText(/Yuklash/, async (msg) => {
    const chatId = msg.chat.id;
    userContextMap.set(chatId, 'save');
    await clearPreviousMessages(chatId);
    const infoMessage = await bot.sendMessage(chatId, 'Siz yuklovchi bot xizmatini tanladingiz');
    addMessageToContext(chatId, infoMessage.message_id);
    handleDownloadCommand(bot, chatId);
});

bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;

    if (message && data) {
        const chatId = message.chat.id;

        await clearPreviousMessages(chatId);

        if (data === 'translate') {
            userContextMap.set(chatId, 'translate');
            setTranslationLanguage(bot, chatId, userLanguageMap);
        } else if (data === 'download') {
            userContextMap.set(chatId, 'save');
            handleDownloadCommand(bot, chatId);
        } else if (data.startsWith('lang_')) {
            handleTranslationCommand(bot, message, data, userLanguageMap);
        }
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);

    if (msg.text && !msg.text.startsWith('/') && !["Bot turini o'zgartirish", 'Tarjima', 'Yuklash'].includes(msg.text)) {
        await clearPreviousMessages(chatId);

        if (context === 'translate') {
            handleTextMessage(bot, msg, userLanguageMap);
        } else if (context === 'save') {
            handleMediaUrl(bot, msg);
        }
    }
});
