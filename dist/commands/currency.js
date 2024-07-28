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
exports.handleChangeCurrency = exports.handleCurrencyConversion = exports.handleCurrencyPagination = exports.handleCurrencySelection = exports.handleCurrencyCommand = exports.createCurrencyOptions = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
const currencies_1 = require("../utils/currencies");
const systemLangs_1 = require("../utils/systemLangs");
dotenv.config();
const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
if (!EXCHANGE_RATE_API_KEY) {
    throw new Error('EXCHANGE_RATE_API_KEY is not defined in environment variables');
}
const userMessageMap = new Map();
const userCurrencyMap = new Map();
const addMessageToContext = (chatId, messageId) => {
    const messages = userMessageMap.get(chatId) || [];
    messages.push(messageId);
    userMessageMap.set(chatId, messages);
};
const createCurrencyOptions = (step, page = 1) => {
    const itemsPerPage = 18;
    const offset = (page - 1) * itemsPerPage;
    const paginatedCurrencies = currencies_1.currencies.slice(offset, offset + itemsPerPage);
    const inlineKeyboard = [];
    for (let i = 0; i < paginatedCurrencies.length; i += 3) {
        const row = paginatedCurrencies.slice(i, i + 3).map(currency => ({
            text: `${currency.flag} ${currency.code}`,
            callback_data: `${step}_${currency.code}`
        }));
        inlineKeyboard.push(row);
    }
    if (currencies_1.currencies.length > itemsPerPage) {
        const paginationButtons = [];
        if (page > 1) {
            paginationButtons.push({ text: '⬅️ Previous', callback_data: `${step}_page_${page - 1}` });
        }
        if (offset + itemsPerPage < currencies_1.currencies.length) {
            paginationButtons.push({ text: 'Next ➡️', callback_data: `${step}_page_${page + 1}` });
        }
        inlineKeyboard.push(paginationButtons);
    }
    return {
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    };
};
exports.createCurrencyOptions = createCurrencyOptions;
const handleCurrencyCommand = async (bot, chatId) => {
    const sentMessage = await bot.sendMessage(chatId, (0, systemLangs_1.translateMessage)(chatId, 'Which currency do you want to calculate?'), (0, exports.createCurrencyOptions)('from'));
    addMessageToContext(chatId, sentMessage.message_id);
};
exports.handleCurrencyCommand = handleCurrencyCommand;
const handleCurrencySelection = async (bot, callbackQuery, data, step) => {
    const messageId = callbackQuery.message?.message_id;
    const chatId = callbackQuery.message?.chat.id;
    const currencyCode = data.split('_')[1];
    if (!chatId || !messageId)
        return;
    if (step === 'from') {
        userCurrencyMap.set(chatId, { from: currencyCode, to: '' });
        await bot.editMessageText((0, systemLangs_1.translateMessage)(chatId, 'You have selected the currency {curr} {flag}. Which currency do you want to calculate now?', { curr: currencyCode, flag: currencies_1.currencies.find(c => c.code === currencyCode)?.flag }), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: (0, exports.createCurrencyOptions)('to').reply_markup
        });
    }
    else if (step === 'to') {
        const userCurrencies = userCurrencyMap.get(chatId);
        if (userCurrencies) {
            userCurrencies.to = currencyCode;
            userCurrencyMap.set(chatId, userCurrencies);
            await bot.editMessageText((0, systemLangs_1.translateMessage)(chatId, 'You have chosen to calculate from {curr_1} {flag_1} currency to {curr_2} {flag_2} currency. Please enter an amount:\n\n/change_currency - change currency', {
                curr_1: userCurrencies.from,
                flag_1: currencies_1.currencies.find(c => c.code === userCurrencies.from)?.flag,
                curr_2: currencyCode,
                flag_2: currencies_1.currencies.find(c => c.code === currencyCode)?.flag
            }), {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: [], } // Toza markup bilan
            });
        }
    }
};
exports.handleCurrencySelection = handleCurrencySelection;
const handleCurrencyPagination = async (bot, callbackQuery, step, page) => {
    const messageId = callbackQuery.message?.message_id;
    const chatId = callbackQuery.message?.chat.id;
    if (messageId && chatId) {
        await bot.editMessageReplyMarkup((0, exports.createCurrencyOptions)(step, page).reply_markup, {
            chat_id: chatId,
            message_id: messageId
        });
    }
};
exports.handleCurrencyPagination = handleCurrencyPagination;
const handleCurrencyConversion = async (bot, msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userCurrencies = userCurrencyMap.get(chatId);
    if (userCurrencies && userCurrencies.from && userCurrencies.to) {
        const amount = parseFloat(text);
        if (isNaN(amount)) {
            const sentMessage = await bot.sendMessage(chatId, 'Please enter the correct amount:', {
                reply_markup: {
                    keyboard: [
                        [{ text: (0, systemLangs_1.getUserLanguage)(chatId) === 'uz' ? 'Bot turini o\'zgartirish' : (0, systemLangs_1.getUserLanguage)(chatId) === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                },
                reply_to_message_id: msg.message_id
            });
            addMessageToContext(chatId, sentMessage.message_id);
            return;
        }
        try {
            bot.sendChatAction(chatId, 'typing');
            const response = await axios_1.default.get(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/${userCurrencies.from}`);
            const rate = response.data.conversion_rates[userCurrencies.to];
            const convertedAmount = (amount * rate).toFixed(2);
            const sentMessage = await bot.sendMessage(chatId, `${amount} ${userCurrencies.from} ${currencies_1.currencies.find(c => c.code === userCurrencies.from)?.flag} = ${convertedAmount} ${userCurrencies.to} ${currencies_1.currencies.find(c => c.code === userCurrencies.to)?.flag}`, {
                reply_markup: {
                    keyboard: [
                        [{ text: (0, systemLangs_1.getUserLanguage)(chatId) === 'uz' ? 'Bot turini o\'zgartirish' : (0, systemLangs_1.getUserLanguage)(chatId) === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                },
                reply_to_message_id: msg.message_id
            });
            addMessageToContext(chatId, sentMessage.message_id);
        }
        catch (error) {
            const sentMessage = await bot.sendMessage(chatId, (0, systemLangs_1.translateMessage)(chatId, 'An error occurred while retrieving exchange rates. Please try again later.'), {
                reply_markup: {
                    keyboard: [
                        [{ text: "Bot turini o'zgartirish" }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                }
            });
            addMessageToContext(chatId, sentMessage.message_id);
        }
    }
    else {
        const sentMessage = await bot.sendMessage(chatId, (0, systemLangs_1.translateMessage)(chatId, 'Please select currencies first.'));
        addMessageToContext(chatId, sentMessage.message_id);
    }
};
exports.handleCurrencyConversion = handleCurrencyConversion;
const handleChangeCurrency = async (bot, msg) => {
    const chatId = msg.chat.id;
    userCurrencyMap.delete(chatId);
    await (0, exports.handleCurrencyCommand)(bot, chatId);
};
exports.handleChangeCurrency = handleChangeCurrency;
//# sourceMappingURL=currency.js.map