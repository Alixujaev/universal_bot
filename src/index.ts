import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import { handleCurrencyCommand, handleCurrencySelection, handleCurrencyConversion, handleCurrencyPagination, handleChangeCurrency } from './commands/currency';
import { handleTranslationCommand, setTranslationLanguage, handleTextMessage } from './commands/translator';
import { handleConvertCommand, handleFileConversion, handleDocumentMessage, handleVideoMessage } from './commands/converter';
import { handleDownloadCommand, handleMediaUrl } from './commands/downloader';
import { getUserLanguage, languageOptions, selectLanguage, translateMessage, userLanguageMap } from './utils/systemLangs';
import { clearPreviousMessages, mainMenuOptions, sendMessage } from './utils/mainMenu';

dotenv.config();
const LOCAL_BOT_API_URL = process.env.LOCAL_BOT_API_URL || 'https://api.telegram.org/bot';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const APP_URL = process.env.APP_URL; // Heroku URL
const PORT = process.env.PORT || 3000;

export const bot = new TelegramBot(TELEGRAM_TOKEN, { 
    polling: false,
    baseApiUrl: LOCAL_BOT_API_URL
 });

const app = express();
app.use(bodyParser.json());

bot.setWebHook(`${APP_URL}/bot${TELEGRAM_TOKEN}`);

app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

const userContextMap = new Map<number, string>();
const userLangsMap = new Map<number, { code: string, name: string, flag: string }>();

// Har bir buyrug'ni dinamik ravishda aniqlash
const commands = ['Change bot type', 'Translation', 'Download', 'Currency Calculator', 'File Conversion', 'Изменить режим работы бота'];

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    userContextMap.set(chatId, 'main');
    await clearPreviousMessages(chatId, bot);
    await selectLanguage(chatId, bot);
});

bot.onText(/\/change_language/, async (msg) => {
    const chatId = msg.chat.id;
    await clearPreviousMessages(chatId, bot);
    await selectLanguage(chatId, bot);
});

['Bot turini o\'zgartirish', 'Change bot type', 'Изменить режим работы бота'].forEach(command => {
    bot.onText(new RegExp(`^${command}$`), async (msg) => {
        const chatId = msg.chat.id;
        if((command === 'Bot turini o\'zgartirish' && getUserLanguage(chatId) === 'uz') || (command === 'Change bot type' && getUserLanguage(chatId) === 'en') || (command === 'Изменить режим работы бота' && getUserLanguage(chatId) === 'ru')) {
            userContextMap.set(chatId, 'main');
            await clearPreviousMessages(chatId, bot);
            // await selectLanguage(chatId, bot);
            sendMessage(chatId, bot, 'Please choose from the menu below:', mainMenuOptions(chatId));
        }else{
            await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions(chatId));
        }
    });
});

['Translation', 'Tarjima', 'Перевод'].forEach(command => {
    bot.onText(new RegExp(`^${command}$`), async (msg) => {
        const chatId = msg.chat.id;
        if((command === 'Translation' && getUserLanguage(chatId) === 'en') || (command === 'Tarjima' && getUserLanguage(chatId) === 'uz') || (command === 'Перевод' && getUserLanguage(chatId) === 'ru')) {
        userContextMap.set(chatId, 'translate');
        await clearPreviousMessages(chatId, bot);
        await sendMessage(chatId, bot, 'You have selected the translation bot. Here you can translate texts.');
        setTranslationLanguage(bot, chatId);
        }else{
            await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions(chatId));
        }
    });
});

['Download', 'Yuklash', 'Скачать'].forEach(command => {
    bot.onText(new RegExp(`^${command}$`), async (msg) => {
        const chatId = msg.chat.id;
        if ((command === 'Download' && getUserLanguage(chatId) === 'en') || (command === 'Yuklash' && getUserLanguage(chatId) === 'uz') || (command === 'Скачать' && getUserLanguage(chatId) === 'ru')) {
            userContextMap.set(chatId, 'save');
            await clearPreviousMessages(chatId, bot);
            await sendMessage(chatId, bot, 'You have selected the downloader service.');
            handleDownloadCommand(bot, chatId);
        }else{
            await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions(chatId));
        }
    })
});

['Currency Calculator', 'Valyuta Kalkulyatori', 'Калькулятор валют'].forEach(command => {
    bot.onText(new RegExp(`^${command}$`), async (msg) => {
        const chatId = msg.chat.id;
        if((command === 'Currency Calculator' && getUserLanguage(chatId) === 'en') || (command === 'Valyuta Kalkulyatori' && getUserLanguage(chatId) === 'uz') || (command === 'Калькулятор валют' && getUserLanguage(chatId) === 'ru')) {
            userContextMap.set(chatId, 'currency');
            await clearPreviousMessages(chatId, bot);
            await sendMessage(chatId, bot, 'You have selected the currency calculator.');
            await handleCurrencyCommand(bot, chatId);
        }else{
            await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions(chatId));
        }
    })
});

['File Conversion', 'Fayl Konvertatsiyasi', 'Конвертация файлов'].forEach(command => {
    bot.onText(new RegExp(`^${command}$`), async (msg) => {
        const chatId = msg.chat.id;
        if ((command === 'File conversion' && getUserLanguage(chatId) === 'en') || (command === 'Fayl Konvertatsiyasi' && getUserLanguage(chatId) === 'uz') || (command === 'Конвертация файлов' && getUserLanguage(chatId) === 'ru')) {
            userContextMap.set(chatId, 'convert');
    await clearPreviousMessages(chatId, bot);
    await sendMessage(chatId, bot, 'You have selected the file conversion service.');
    await handleConvertCommand(bot, chatId);
        }else{
            await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions(chatId));
        }
    })
});

bot.onText(/\/change_currency/, async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);
    if (context === 'currency') {
        await clearPreviousMessages(chatId, bot);
        await handleChangeCurrency(bot, msg);
    } else {
        await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions(chatId));
    }
});

bot.onText(/\/setlanguage/, async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);
    if (context === 'translate') {
        await clearPreviousMessages(chatId, bot);
        await setTranslationLanguage(bot, chatId);
    } else {
        await sendMessage(chatId, bot, 'Invalid command. This command only works in "Translation" mode.');
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;

    if (message && data) {
        const chatId = message.chat.id;

        await clearPreviousMessages(chatId, bot);

        if (data.startsWith('start_lang_')) {
            const selectedLang = languageOptions.find(lang => `start_lang_${lang.code}` === data);
            if (selectedLang) {
                userLanguageMap.set(chatId, selectedLang);
                await sendMessage(chatId, bot, 'Welcome to the universal bot! Please choose from the menu below:', mainMenuOptions(chatId,));
            }
        } else {
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
                setTranslationLanguage(bot, chatId);
            } else if (data === 'download') {
                userContextMap.set(chatId, 'save');
                handleDownloadCommand(bot, chatId);
            } else if (data.startsWith('lang_')) {
                await handleTranslationCommand(bot, callbackQuery, data, userLangsMap);
            } else if (data.startsWith('convert_')) {
                await handleFileConversion(bot, callbackQuery);
            }
        }
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);

    if (msg.text && !msg.text.startsWith('/') && !commands.map(cmd => translateMessage(chatId, cmd)).includes(msg.text)) {
        await clearPreviousMessages(chatId, bot);

        if (context === 'translate') {
            handleTextMessage(bot, msg, userLangsMap);
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
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const fileName = `photo_${fileId}.jpg`;
        const mimeType = 'image/jpeg';

        await handleDocumentMessage(bot, { ...msg, document: { file_id: fileId, file_name: fileName, mime_type: mimeType } });
    } else if (msg.video || msg.video_note) {
        console.log('Video message received');
        await handleVideoMessage(bot, msg);
    }
});

app.listen(PORT, () => {
    console.log(`Bot is listening on port ${PORT}`);
  });
