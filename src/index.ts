import * as dotenv from 'dotenv';
import { 
    handleCurrencyCommand, handleCurrencySelection, handleCurrencyConversion, handleCurrencyPagination, handleChangeCurrency 
} from './commands/currency';
import { 
    handleTranslationCommand, setTranslationLanguage, handleTextMessage 
} from './commands/translator';
import { 
    handleConvertCommand, handleFileConversion, handleDocumentMessage, handleVideoMessage, handleAudioMessage 
} from './commands/converter';
import { 
    handleDownloadCommand, handleMediaUrl 
} from './commands/downloader';
import {  languageOptions, selectLanguage, translateMessage 
} from './utils/systemLangs';
import {  mainMenuOptions, sendMessage 
} from './utils/mainMenu';
import { User } from './utils/user';
import { UserType } from './types';
import { bot } from './botInstance';
import { broadcastMessage, handleAdminCommand, handleStatsCommand } from './admin';
import { connectDatabase } from './database';
import { handleTextToVoice, handleTextToVoiceCommand, handleVoiceToText } from './commands/voice';

dotenv.config();
connectDatabase();

const userContextMap = new Map<number, string>();
const userLangsMap = new Map<number, { code: string, name: string, flag: string }>();
export let user: UserType = {
    chatId: 0,
    name: '',
    language: { code: 'en', name: 'English', flag: '🇬🇧' },
    is_premium: false
}

const Commands = {
    CHANGE_TYPE: ['Change bot type', 'Bot turini o\'zgartirish', 'Изменить режим работы бота'],
    TRANSLATION: ['Translation', 'Tarjima', 'Перевод'],
    DOWNLOAD: ['Download', 'Yuklash', 'Скачать'],
    CURRENCY: ['Currency Calculator', 'Valyuta Kalkulyatori', 'Калькулятор валют'],
    CONVERT: ['File Conversion', 'Fayl Konvertatsiyasi', 'Конвертация файлов'],
    VOICE: ['Text to voice', 'Matnni ovozga aylantirish', 'Текст в голос'],
    ADMIN: ['/admin'] // Admin buyruqni qo'shish
};

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
        (command === 'Конвертация файлов' && lang === 'ru') || 
        (command === 'Text to voice' && lang === 'en') ||
        (command === 'Matnni ovozga aylantirish' && lang === 'uz') ||
        (command === 'Текст в голос' && lang === 'ru')
    );
}

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code);  // => 'EFATAL'
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error.code);  // => 'EPARSE'
});

bot.onText(/\/start/, async (msg) => {
    if(msg.from.is_bot) return;
    const existUser = await User.findOne({ chatId: msg.chat.id });
    const chatId = msg.chat.id;
    userContextMap.set(chatId, 'main');
    await selectLanguage(chatId, bot);
    if(!existUser){
        await User.create({ 
            chatId, 
            name: msg.chat.first_name ? msg.chat.first_name : "Default", 
            context: "", 
            language: {}, 
            translate_lang: {}, 
            currency_from: {}, 
            currency_to: {}, 
            is_premium: false
         });
    }
});

bot.onText(/\/change_language/, async (msg) => {
    const chatId = msg.chat.id;
    await selectLanguage(chatId, bot);
});

bot.onText(/\/stats/, handleStatsCommand);

function handleGeneralCommands(commandsArray: string[], context: string, callback: Function) {
    commandsArray.forEach(command => {
        bot.onText(new RegExp(`^${command}$`), async (msg) => {
            const chatId = msg.chat.id;
            if (isValidCommand(command, context, user.language.code)) {
                userContextMap.set(chatId, context);
                await callback(chatId);
            } else {
                await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions());
            }
        });
    });
}

handleGeneralCommands(Commands.CHANGE_TYPE, 'main', async (chatId: number) => {
    sendMessage(chatId, bot, 'Please choose from the menu below:', mainMenuOptions());
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

handleGeneralCommands(Commands.VOICE, 'voice', async (chatId: number) => {
    await sendMessage(chatId, bot, 'You have selected the TTS service.');
    await handleTextToVoiceCommand(bot, chatId);
});

bot.onText(/\/change_currency/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`/change_currency command received from chat ID ${chatId}`);
    
    if (userContextMap.get(chatId) === 'currency') {
        await handleChangeCurrency(bot, msg);
    } else {
        await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions());
    }
});

bot.onText(/\/setlanguage/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`/setlanguage command received from chat ID ${chatId}`);
    if (userContextMap.get(chatId) === 'translate') {
        await setTranslationLanguage(bot, chatId);
    } else {
        await sendMessage(chatId, bot, 'Invalid command. This command only works in "Translation" mode.');
    }
});

bot.onText(/\/admin/, handleAdminCommand);

bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = message?.chat.id;

    if (message && data) {
        
        if (data.startsWith('start_lang_')) {
            const selectedLang = languageOptions.find(lang => `start_lang_${lang.code}` === data);
            if (selectedLang) {
                user = await User.findOneAndUpdate({ chatId }, { language: selectedLang }, { new: true });     
                await sendMessage(chatId, bot, 'Welcome to the universal bot! Please choose from the menu below:', mainMenuOptions());
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
        }else if (data === 'voice'){
            await handleTextToVoiceCommand(bot, chatId);
        }
    }
});


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);
    
    await broadcastMessage(msg);

    if (msg  && !Commands.CHANGE_TYPE.concat(Commands.TRANSLATION, Commands.DOWNLOAD, Commands.CURRENCY, Commands.CONVERT).map(cmd => translateMessage(chatId, cmd)).includes(msg.text)) {
        if(context === 'main'){
            bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions());
        }else if (context === 'translate') {
            if(msg.document || msg.video || msg.photo || msg.video_note || msg.audio || msg.audio_note) {
                await bot.sendMessage(chatId, 'Bu statusda file yuklash mumkin emas.');
            }
            handleTextMessage(bot, msg, userLangsMap);
        } else if (context === 'save') {
            if(msg.document || msg.video || msg.photo || msg.video_note || msg.audio || msg.audio_note) {
                await bot.sendMessage(chatId, 'Bu statusda file yuklash mumkin emas.');
            }
            handleMediaUrl(bot, msg);
        } else if (context === 'currency') {
            handleCurrencyConversion(bot, msg);
        } else if (context === 'convert') {
            if (msg.document) {
                await handleDocumentMessage(bot, msg);
            } else if (msg.video) {
                await handleVideoMessage(bot, msg);
            }
        } else if (context === 'voice') {
            if(msg.voice || msg.audio){
                console.log('VOICEEE INDEX');
                
                handleVoiceToText(bot, msg);
            }else{
                handleTextToVoice(bot, msg);
            }
        }
    }

    if (msg.document && Commands.CONVERT.includes(msg.text)) {
        await handleDocumentMessage(bot, msg);
    } else if (msg.photo && Commands.CONVERT.includes(msg.text)) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const fileName = `photo_${fileId}.jpg`;
        const mimeType = 'image/jpeg';

        await handleDocumentMessage(bot, { ...msg, document: { file_id: fileId, file_name: fileName, mime_type: mimeType } });
    } else if (msg.video || msg.video_note && Commands.CONVERT.includes(msg.text)) {
        await handleVideoMessage(bot, msg && Commands.CONVERT.includes(msg.text));
    } else if (msg.audio || msg.audio_note) {
        await handleAudioMessage(bot, msg);
    }
});

