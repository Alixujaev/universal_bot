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
import { 
    languageOptions, selectLanguage, translateMessage 
} from './utils/systemLangs';
import { 
    clearPreviousMessages,
    mainMenuOptions, sendMessage 
} from './utils/mainMenu';
import { User } from './utils/user';
import { UserType } from './types';
import { bot } from './botInstance';
import { broadcastMessage, handleAdminCommand, handleStatsCommand } from './admin';
import { connectDatabase } from './database';
import { handleTextToVoice, handleTextToVoiceCommand } from './commands/voice';

// de

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
    ADMIN: ['/admin']
};

function isValidCommand(command: string, context: string, lang: string) {
    const commandList = {
        'Change bot type': 'en',
        'Bot turini o\'zgartirish': 'uz',
        'Изменить режим работы бота': 'ru',
        'Translation': 'en',
        'Tarjima': 'uz',
        'Перевод': 'ru',
        'Download': 'en',
        'Yuklash': 'uz',
        'Скачать': 'ru',
        'Currency Calculator': 'en',
        'Valyuta Kalkulyatori': 'uz',
        'Калькулятор валют': 'ru',
        'File Conversion': 'en',
        'Fayl Konvertatsiyasi': 'uz',
        'Конвертация файлов': 'ru',
        'Text to voice': 'en',
        'Matnni ovozga aylantirish': 'uz',
        'Текст в голос': 'ru'
    };
    return commandList[command] === lang;
}

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code);  // => 'EFATAL'
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error.code);  // => 'EPARSE'
});

bot.onText(/\/start/, async (msg) => {
    if (msg.from.is_bot) return;
    const chatId = msg.chat.id;
    userContextMap.set(chatId, 'main');
    await selectLanguage(chatId, bot);

    const existUser = await User.findOne({ chatId });
    if (!existUser) {
        await User.create({ 
            chatId, 
            name: msg.chat.first_name || "Default", 
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
                await bot.sendMessage(chatId, 'Invalid command. Please select a valid option. INVALID 1', mainMenuOptions());
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
    
    if (userContextMap.get(chatId) === 'currency') {
        await handleChangeCurrency(bot, msg);
    } else {
        await bot.sendMessage(chatId, 'Invalid command. Please select a valid option.', mainMenuOptions());
    }
});

bot.onText(/\/setlanguage/, async (msg) => {
    const chatId = msg.chat.id;
    if (userContextMap.get(chatId) === 'translate') {
        await setTranslationLanguage(bot, chatId);
    } else {
        await sendMessage(chatId, bot, 'Invalid command. This command only works in "Translation" mode.');
    }
});

bot.onText(/\/vip/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, 'VIP status \n\n2500 ta harf \nOvoz tillari: English 🇺🇸, Russian 🇷🇺, Uzbek 🇺🇿 \n\n1 oylik xizmat narxi: 10000 so`m', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Visa, Mastercard bilan tolov 🌍', callback_data: 'global_pay' },
                    { text: "O'zbekiston bo'yicha tolov 🇺🇿", callback_data: 'uz_pay' },
                ],
            ],
        },
    });
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
                clearPreviousMessages(chatId, bot);
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
        } else if (data === 'voice') {
            await handleTextToVoiceCommand(bot, chatId);
        }


        if(data === 'uz_pay') {
            await bot.sendMessage(chatId, "O'zbekiston ichida Click yoki Payme ilovalari orqali tolov qilish imkoniyati mavjud.\n\n1 oylik xizmat narxi: 10000 so'm\nShulardan birini tanlang 👇🏻", {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Click', callback_data: 'click' },
                            { text: "Payme", callback_data: 'payme' },
                        ],
                    ],
                },
            });
        }
        
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const context = userContextMap.get(chatId);

    await broadcastMessage(msg);

    if (msg && !Commands.CHANGE_TYPE.concat(Commands.TRANSLATION, Commands.DOWNLOAD, Commands.CURRENCY, Commands.CONVERT).map(cmd => translateMessage(chatId, cmd)).includes(msg.text)) {
         if (context === 'translate') {
            if (msg.document || msg.video || msg.photo || msg.video_note || msg.audio || msg.audio_note) {
                await bot.sendMessage(chatId, 'Bu statusda file yuklash mumkin emas.');
            }
            handleTextMessage(bot, msg, userLangsMap);
        } else if (context === 'save') {
            if (msg.document || msg.video || msg.photo || msg.video_note || msg.audio || msg.audio_note) {
                await bot.sendMessage(chatId, 'Bu statusda file yuklash mumkin emas.');
            }
            handleMediaUrl(bot, msg);
        } else if (context === 'currency') {
            handleCurrencyConversion(bot, msg);
        } else if (context === 'convert') {
            console.log('CONTEXT', context);
            
            if (msg.document) {
                await handleDocumentMessage(bot, msg);
            } else if (msg.video) {
                await handleVideoMessage(bot, msg);
            }
        } else if (context === 'voice') {
            handleTextToVoice(bot, msg);
        }
    }

    if (msg.document) {
        console.log('CONTEXT', context);
        await handleDocumentMessage(bot, msg);
    } else if (msg.photo) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const fileName = `photo_${fileId}.jpg`;
        const mimeType = 'image/jpeg';

        await handleDocumentMessage(bot, { ...msg, document: { file_id: fileId, file_name: fileName, mime_type: mimeType } });
    } else if (msg.video || msg.video_note) {
        await handleVideoMessage(bot, msg);
    } else if (msg.audio || msg.audio_note) {
        await handleAudioMessage(bot, msg);
    }
});
