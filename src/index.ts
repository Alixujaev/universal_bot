import { handleCurrencyCommand, handleCurrencySelection, handleCurrencyConversion, handleCurrencyPagination, handleChangeCurrency } from './commands/currency';
import { handleTranslationCommand, setTranslationLanguage, handleTextMessage } from './commands/translator';
import { handleConvertCommand, handleFileConversion, handleDocumentMessage, handleVideoMessage } from './commands/converter';
import { handleDownloadCommand, handleMediaUrl } from './commands/downloader';

import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
export const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const userContextMap = new Map<number, string>();
const userLanguageMap = new Map<number, { code: string, name: string, flag: string }>();
const userMessageMap = new Map<number, number[]>();

const mainMenuOptions = {
    reply_markup: {
        keyboard: [
            [{ text: 'Tarjima' }, { text: 'Yuklash' }],
            [{ text: 'Valyuta Kalkulyatori' }, { text: 'Fayl Konvertatsiyasi' }]
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

bot.onText(/Valyuta Kalkulyatori/, async (msg) => {
    const chatId = msg.chat.id;
    userContextMap.set(chatId, 'currency');
    await clearPreviousMessages(chatId);
    await handleCurrencyCommand(bot, chatId);
});

bot.onText(/Fayl Konvertatsiyasi/, async (msg) => {
    const chatId = msg.chat.id;
    userContextMap.set(chatId, 'convert');
    await clearPreviousMessages(chatId);
    await handleConvertCommand(bot, chatId);
});

bot.onText(/\/change_currency/, async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);
    if (context === 'currency') {
        await clearPreviousMessages(chatId);
        await handleChangeCurrency(bot, msg);
    } else {
        await bot.sendMessage(chatId, 'Noto‘g‘ri amal. Ushbu buyruq faqat "Valyuta Kalkulyatori" rejimida ishlaydi.');
    }
});

bot.onText(/\/setlanguage/, async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);
    if (context === 'translate') {
        await clearPreviousMessages(chatId);
        await setTranslationLanguage(bot, chatId, userLanguageMap);
    } else {
        await bot.sendMessage(chatId, 'Noto‘g‘ri amal. Ushbu buyruq faqat "Tarjima" rejimida ishlaydi.');
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;

    if (message && data) {
        const chatId = message.chat.id;

        await clearPreviousMessages(chatId);

        if (data.startsWith('from_')) {
            if (data.includes('page_')) {
                const page = parseInt(data.split('page_')[1], 10);
                await handleCurrencyPagination(bot, callbackQuery, 'from', page);
            } else {
                await handleCurrencySelection(bot, callbackQuery, data, 'from');
            }
        } else if (data.startsWith('to_')) {
            if (data.includes('page_')) {
                const page = parseInt(data.split('page_')[1], 10);
                await handleCurrencyPagination(bot, callbackQuery, 'to', page);
            } else {
                await handleCurrencySelection(bot, callbackQuery, data, 'to');
            }
        } else if (data === 'translate') {
            userContextMap.set(chatId, 'translate');
            setTranslationLanguage(bot, chatId, userLanguageMap);
        } else if (data === 'download') {
            userContextMap.set(chatId, 'save');
            handleDownloadCommand(bot, chatId);
        } else if (data.startsWith('lang_')) {
            await handleTranslationCommand(bot, callbackQuery, data, userLanguageMap);
        } else if (data.startsWith('convert_')) {
            await handleFileConversion(bot, callbackQuery);
        }
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);

    console.log(msg);

    if (msg.text && !msg.text.startsWith('/') && !["Bot turini o'zgartirish", 'Tarjima', 'Yuklash', 'Valyuta Kalkulyatori', 'Fayl Konvertatsiyasi'].includes(msg.text)) {
        await clearPreviousMessages(chatId);

        if (context === 'translate') {
            handleTextMessage(bot, msg, userLanguageMap);
        } else if (context === 'save') {
            handleMediaUrl(bot, msg);
        } else if (context === 'currency') {
            handleCurrencyConversion(bot, msg);
        } else if (context === 'convert') {
            if (msg.document) {
                await handleDocumentMessage(bot, msg);
            } else if (msg.video) {
                console.log('Video message received');
                await handleVideoMessage(bot, msg);
            }
        }
    }

    if (msg.document) {
        await handleDocumentMessage(bot, msg);
    } else if (msg.photo) {
        // If a photo is sent, handle it similarly to a document
        const fileId = msg.photo[msg.photo.length - 1].file_id; // Use the highest resolution photo
        const fileName = `photo_${fileId}.jpg`; // Assign a name to the photo
        const mimeType = 'image/jpeg'; // Photos are usually jpeg

        await handleDocumentMessage(bot, { ...msg, document: { file_id: fileId, file_name: fileName, mime_type: mimeType } });
    } else if (msg.video || msg.video_note) {
        console.log('Video message received');
        await handleVideoMessage(bot, msg);
    }
});
