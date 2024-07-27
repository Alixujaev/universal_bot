import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import { 
    handleCurrencyCommand, handleCurrencySelection, handleCurrencyConversion, handleCurrencyPagination, handleChangeCurrency 
} from './commands/currency';
import { 
    handleTranslationCommand, setTranslationLanguage, handleTextMessage 
} from './commands/translator';
import { 
    handleConvertCommand, handleFileConversion, handleDocumentMessage, handleVideoMessage 
} from './commands/converter';
import { 
    handleDownloadCommand, handleMediaUrl 
} from './commands/downloader';
import { 
    getUserLanguage, languageOptions, selectLanguage, translateMessage, userLanguageMap 
} from './utils/systemLangs';
import { 
    clearPreviousMessages, mainMenuOptions, sendMessage 
} from './utils/mainMenu';

dotenv.config();

const LOCAL_BOT_API_URL = process.env.LOCAL_BOT_API_URL || 'https://api.telegram.org/bot';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const APP_URL = process.env.APP_URL; // Heroku URL
const PORT = process.env.PORT || 3000;  

export const bot = new TelegramBot(TELEGRAM_TOKEN, { 
    polling: true,
    baseApiUrl: LOCAL_BOT_API_URL
});

const userContextMap = new Map<number, string>();
const userLangsMap = new Map<number, { code: string, name: string, flag: string }>();

// Command constants
const Commands = {
    CHANGE_TYPE: ['Change bot type', 'Bot turini o\'zgartirish', 'Изменить режим работы бота'],
    TRANSLATION: ['Translation', 'Tarjima', 'Перевод'],
    DOWNLOAD: ['Download', 'Yuklash', 'Скачать'],
    CURRENCY: ['Currency Calculator', 'Valyuta Kalkulyatori', 'Калькулятор валют'],
    CONVERT: ['File Conversion', 'Fayl Konvertatsiyasi', 'Конвертация файлов'],
};

// Function to handle command text validation
function isValidCommand(command: string, context: string, lang: string) {
    return (
        (command === 'Change bot type' && lang === 'en') ||
        (command === 'Bot turini o\'zgartirish' && lang === 'uz') ||
        (command === 'Изменить режим работы бота' && lang === 'ru') ||
        (command === 'Translation' && lang === 'en') ||
        (command === 'Tarjima' && lang === 'uz') ||
        (command === 'Перевод' && lang === 'ru') ||
        (command === 'Download' && lang === 'en') ||
        (command === 'Yuklash' && lang === 'uz') ||
        (command === 'Скачать' && lang === 'ru') ||
        (command === 'Currency Calculator' && lang === 'en') ||
        (command === 'Valyuta Kalkulyatori' && lang === 'uz') ||
        (command === 'Калькулятор валют' && lang === 'ru') ||
        (command === 'File Conversion' && lang === 'en') ||
        (command === 'Fayl Konvertatsiyasi' && lang === 'uz') ||
        (command === 'Конвертация файлов' && lang === 'ru')
    );
}

// Main bot start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    userContextMap.set(chatId, 'main');
    await clearPreviousMessages(chatId, bot);
    await selectLanguage(chatId, bot);
});

// Change language command
bot.onText(/\/change_language/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(userContextMap.get(chatId));
    
    await clearPreviousMessages(chatId, bot);
    await selectLanguage(chatId, bot);
});

// Generalized command handler
function handleGeneralCommands(commandsArray: string[], context: string, callback: Function) {
    commandsArray.forEach(command => {
        bot.onText(new RegExp(`^${command}$`), async (msg) => {
            const chatId = msg.chat.id;
            if (isValidCommand(command, context, getUserLanguage(chatId))) {
                userContextMap.set(chatId, context);
                await clearPreviousMessages(chatId, bot);
                await callback(chatId);
            } else {
                await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions(chatId));
            }
        });
    });
}

// Setup command handlers
handleGeneralCommands(Commands.CHANGE_TYPE, 'main', async (chatId: number) => {
    sendMessage(chatId, bot, 'Please choose from the menu below:', mainMenuOptions(chatId));
});

handleGeneralCommands(Commands.TRANSLATION, 'translate', async (chatId: number) => {
    await sendMessage(chatId, bot, 'You have selected the translation bot. Here you can translate texts.');
    setTranslationLanguage(bot, chatId);
});

handleGeneralCommands(Commands.DOWNLOAD, 'save', async (chatId: number) => {
    await sendMessage(chatId, bot, 'You have selected the downloader service.');
    handleDownloadCommand(bot, chatId);
});

handleGeneralCommands(Commands.CURRENCY, 'currency', async (chatId: number) => {
    await sendMessage(chatId, bot, 'You have selected the currency calculator.');
    await handleCurrencyCommand(bot, chatId);
});

handleGeneralCommands(Commands.CONVERT, 'convert', async (chatId: number) => {
    await sendMessage(chatId, bot, 'You have selected the file conversion service.');
    await handleConvertCommand(bot, chatId);
});

// Handle specific commands with parameters
bot.onText(/\/change_currency/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (userContextMap.get(chatId) === 'currency') {
        await clearPreviousMessages(chatId, bot);
        await handleChangeCurrency(bot, msg);
    } else {
        await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions(chatId));
    }
});

bot.onText(/\/setlanguage/, async (msg) => {
    const chatId = msg.chat.id;
    if (userContextMap.get(chatId) === 'translate') {
        await clearPreviousMessages(chatId, bot);
        await setTranslationLanguage(bot, chatId);
    } else {
        await sendMessage(chatId, bot, 'Invalid command. This command only works in "Translation" mode.');
    }
});

// Handle callback queries
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
                await sendMessage(chatId, bot, 'Welcome to the universal bot! Please choose from the menu below:', mainMenuOptions(chatId));
            }
        } else if (data.startsWith('from_')) {
            if (data.includes('page_')) {
                const page = parseInt(data.split('page_')[1], 10);
                userContextMap.set(chatId, 'currency');
                await handleCurrencyPagination(bot, callbackQuery, 'from', page);
            } else {
                await handleCurrencySelection(bot, callbackQuery, data, 'from');
            }
        } else if (data.startsWith('to_')) {
            if (data.includes('page_')) {
                const page = parseInt(data.split('page_')[1], 10);
                userContextMap.set(chatId, 'currency');

                await handleCurrencyPagination(bot, callbackQuery, 'to', page);
            } else {
                userContextMap.set(chatId, 'currency');

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
});

// Handle messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);

    if (msg.text && !msg.text.startsWith('/') && !Commands.CHANGE_TYPE.concat(Commands.TRANSLATION, Commands.DOWNLOAD, Commands.CURRENCY, Commands.CONVERT).map(cmd => translateMessage(chatId, cmd)).includes(msg.text)) {
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
