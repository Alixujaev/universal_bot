"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const dotenv = __importStar(require("dotenv"));
const currency_1 = require("./commands/currency");
const translator_1 = require("./commands/translator");
const converter_1 = require("./commands/converter");
const downloader_1 = require("./commands/downloader");
const systemLangs_1 = require("./utils/systemLangs");
const mainMenu_1 = require("./utils/mainMenu");
dotenv.config();
const LOCAL_BOT_API_URL = 'http://localhost:8081/bot';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
exports.bot = new node_telegram_bot_api_1.default(TELEGRAM_TOKEN, {
    polling: true,
    baseApiUrl: LOCAL_BOT_API_URL
});
const userContextMap = new Map();
const userLangsMap = new Map();
// Command constants
const Commands = {
    CHANGE_TYPE: ['Change bot type', 'Bot turini o\'zgartirish', 'Изменить режим работы бота'],
    TRANSLATION: ['Translation', 'Tarjima', 'Перевод'],
    DOWNLOAD: ['Download', 'Yuklash', 'Скачать'],
    CURRENCY: ['Currency Calculator', 'Valyuta Kalkulyatori', 'Калькулятор валют'],
    CONVERT: ['File Conversion', 'Fayl Konvertatsiyasi', 'Конвертация файлов'],
};
// Function to handle command text validation
function isValidCommand(command, context, lang) {
    return ((command === 'Change bot type' && lang === 'en') ||
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
        (command === 'Конвертация файлов' && lang === 'ru'));
}
// Main bot start command
exports.bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    userContextMap.set(chatId, 'main');
    await (0, mainMenu_1.clearPreviousMessages)(chatId, exports.bot);
    await (0, systemLangs_1.selectLanguage)(chatId, exports.bot);
});
// Change language command
exports.bot.onText(/\/change_language/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(userContextMap.get(chatId));
    await (0, mainMenu_1.clearPreviousMessages)(chatId, exports.bot);
    await (0, systemLangs_1.selectLanguage)(chatId, exports.bot);
});
// Generalized command handler
function handleGeneralCommands(commandsArray, context, callback) {
    commandsArray.forEach(command => {
        exports.bot.onText(new RegExp(`^${command}$`), async (msg) => {
            const chatId = msg.chat.id;
            if (isValidCommand(command, context, (0, systemLangs_1.getUserLanguage)(chatId))) {
                userContextMap.set(chatId, context);
                await (0, mainMenu_1.clearPreviousMessages)(chatId, exports.bot);
                await callback(chatId);
            }
            else {
                await exports.bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', (0, mainMenu_1.mainMenuOptions)(chatId));
            }
        });
    });
}
// Setup command handlers
handleGeneralCommands(Commands.CHANGE_TYPE, 'main', async (chatId) => {
    (0, mainMenu_1.sendMessage)(chatId, exports.bot, 'Please choose from the menu below:', (0, mainMenu_1.mainMenuOptions)(chatId));
});
handleGeneralCommands(Commands.TRANSLATION, 'translate', async (chatId) => {
    await (0, mainMenu_1.sendMessage)(chatId, exports.bot, 'You have selected the translation bot. Here you can translate texts.');
    (0, translator_1.setTranslationLanguage)(exports.bot, chatId);
});
handleGeneralCommands(Commands.DOWNLOAD, 'save', async (chatId) => {
    await (0, mainMenu_1.sendMessage)(chatId, exports.bot, 'You have selected the downloader service.');
    (0, downloader_1.handleDownloadCommand)(exports.bot, chatId);
});
handleGeneralCommands(Commands.CURRENCY, 'currency', async (chatId) => {
    await (0, mainMenu_1.sendMessage)(chatId, exports.bot, 'You have selected the currency calculator.');
    await (0, currency_1.handleCurrencyCommand)(exports.bot, chatId);
});
handleGeneralCommands(Commands.CONVERT, 'convert', async (chatId) => {
    await (0, mainMenu_1.sendMessage)(chatId, exports.bot, 'You have selected the file conversion service.');
    await (0, converter_1.handleConvertCommand)(exports.bot, chatId);
});
// Handle specific commands with parameters
exports.bot.onText(/\/change_currency/, async (msg) => {
    const chatId = msg.chat.id;
    if (userContextMap.get(chatId) === 'currency') {
        await (0, mainMenu_1.clearPreviousMessages)(chatId, exports.bot);
        await (0, currency_1.handleChangeCurrency)(exports.bot, msg);
    }
    else {
        await exports.bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', (0, mainMenu_1.mainMenuOptions)(chatId));
    }
});
exports.bot.onText(/\/setlanguage/, async (msg) => {
    const chatId = msg.chat.id;
    if (userContextMap.get(chatId) === 'translate') {
        await (0, mainMenu_1.clearPreviousMessages)(chatId, exports.bot);
        await (0, translator_1.setTranslationLanguage)(exports.bot, chatId);
    }
    else {
        await (0, mainMenu_1.sendMessage)(chatId, exports.bot, 'Invalid command. This command only works in "Translation" mode.');
    }
});
// Handle callback queries
exports.bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    if (message && data) {
        const chatId = message.chat.id;
        await (0, mainMenu_1.clearPreviousMessages)(chatId, exports.bot);
        if (data.startsWith('start_lang_')) {
            const selectedLang = systemLangs_1.languageOptions.find(lang => `start_lang_${lang.code}` === data);
            if (selectedLang) {
                systemLangs_1.userLanguageMap.set(chatId, selectedLang);
                await (0, mainMenu_1.sendMessage)(chatId, exports.bot, 'Welcome to the universal bot! Please choose from the menu below:', (0, mainMenu_1.mainMenuOptions)(chatId));
            }
        }
        else if (data.startsWith('from_')) {
            if (data.includes('page_')) {
                const page = parseInt(data.split('page_')[1], 10);
                userContextMap.set(chatId, 'currency');
                await (0, currency_1.handleCurrencyPagination)(exports.bot, callbackQuery, 'from', page);
            }
            else {
                await (0, currency_1.handleCurrencySelection)(exports.bot, callbackQuery, data, 'from');
            }
        }
        else if (data.startsWith('to_')) {
            if (data.includes('page_')) {
                const page = parseInt(data.split('page_')[1], 10);
                userContextMap.set(chatId, 'currency');
                await (0, currency_1.handleCurrencyPagination)(exports.bot, callbackQuery, 'to', page);
            }
            else {
                userContextMap.set(chatId, 'currency');
                await (0, currency_1.handleCurrencySelection)(exports.bot, callbackQuery, data, 'to');
            }
        }
        else if (data === 'translate') {
            userContextMap.set(chatId, 'translate');
            (0, translator_1.setTranslationLanguage)(exports.bot, chatId);
        }
        else if (data === 'download') {
            userContextMap.set(chatId, 'save');
            (0, downloader_1.handleDownloadCommand)(exports.bot, chatId);
        }
        else if (data.startsWith('lang_')) {
            await (0, translator_1.handleTranslationCommand)(exports.bot, callbackQuery, data, userLangsMap);
        }
        else if (data.startsWith('convert_')) {
            await (0, converter_1.handleFileConversion)(exports.bot, callbackQuery);
        }
    }
});
// Handle messages
exports.bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);
    if (msg.text && !msg.text.startsWith('/') && !Commands.CHANGE_TYPE.concat(Commands.TRANSLATION, Commands.DOWNLOAD, Commands.CURRENCY, Commands.CONVERT).map(cmd => (0, systemLangs_1.translateMessage)(chatId, cmd)).includes(msg.text)) {
        await (0, mainMenu_1.clearPreviousMessages)(chatId, exports.bot);
        if (context === 'translate') {
            (0, translator_1.handleTextMessage)(exports.bot, msg, userLangsMap);
        }
        else if (context === 'save') {
            (0, downloader_1.handleMediaUrl)(exports.bot, msg);
        }
        else if (context === 'currency') {
            (0, currency_1.handleCurrencyConversion)(exports.bot, msg);
        }
        else if (context === 'convert') {
            if (msg.document) {
                await (0, converter_1.handleDocumentMessage)(exports.bot, msg);
            }
            else if (msg.video) {
                console.log('Video message received');
                await (0, converter_1.handleVideoMessage)(exports.bot, msg);
            }
        }
    }
    if (msg.document) {
        await (0, converter_1.handleDocumentMessage)(exports.bot, msg);
    }
    else if (msg.photo) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const fileName = `photo_${fileId}.jpg`;
        const mimeType = 'image/jpeg';
        await (0, converter_1.handleDocumentMessage)(exports.bot, { ...msg, document: { file_id: fileId, file_name: fileName, mime_type: mimeType } });
    }
    else if (msg.video || msg.video_note) {
        console.log('Video message received');
        await (0, converter_1.handleVideoMessage)(exports.bot, msg);
    }
});
//# sourceMappingURL=index.js.map