import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { currencies } from '../utils/currencies';

dotenv.config();

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;

if (!EXCHANGE_RATE_API_KEY) {
    throw new Error('EXCHANGE_RATE_API_KEY is not defined in environment variables');
}

const userMessageMap = new Map<number, number[]>();
const userCurrencyMap = new Map<number, { from: string, to: string }>();

const addMessageToContext = (chatId: number, messageId: number) => {
    const messages = userMessageMap.get(chatId) || [];
    messages.push(messageId);
    userMessageMap.set(chatId, messages);
};

export const createCurrencyOptions = (step: 'from' | 'to', page: number = 1) => {
  const itemsPerPage = 18;
  const offset = (page - 1) * itemsPerPage;
  const paginatedCurrencies = currencies.slice(offset, offset + itemsPerPage);

  const inlineKeyboard = [];
  for (let i = 0; i < paginatedCurrencies.length; i += 3) {
      const row = paginatedCurrencies.slice(i, i + 3).map(currency => ({
          text: `${currency.flag} ${currency.code}`,
          callback_data: `${step}_${currency.code}`
      }));
      inlineKeyboard.push(row);
  }

  if (currencies.length > itemsPerPage) {
      const paginationButtons = [];
      if (page > 1) {
          paginationButtons.push({ text: '⬅️ Previous', callback_data: `${step}_page_${page - 1}` });
      }
      if (offset + itemsPerPage < currencies.length) {
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


export const handleCurrencyCommand = async (bot: TelegramBot, chatId: number) => {
    const sentMessage = await bot.sendMessage(chatId, 'Iltimos, qaysi valyutani kalkulyatsiya qilishni xohlaysiz?', createCurrencyOptions('from'));
    addMessageToContext(chatId, sentMessage.message_id);
};

export const handleCurrencySelection = async (bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery, data: string, step: 'from' | 'to') => {
    const messageId = callbackQuery.message?.message_id;
    const chatId = callbackQuery.message?.chat.id;
    const currencyCode = data.split('_')[1];

    if (!chatId || !messageId) return;

    if (step === 'from') {
        userCurrencyMap.set(chatId, { from: currencyCode, to: '' });
        await bot.editMessageText(`Siz ${currencyCode} ${currencies.find(c => c.code === currencyCode)?.flag} valyutasini tanladingiz. Endi qaysi valyutaga kalkulyatsiya qilishni xohlaysiz?`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: createCurrencyOptions('to').reply_markup
        });
    } else if (step === 'to') {
        const userCurrencies = userCurrencyMap.get(chatId);
        if (userCurrencies) {
            userCurrencies.to = currencyCode;
            userCurrencyMap.set(chatId, userCurrencies);
            await bot.editMessageText(`Siz ${userCurrencies.from} ${currencies.find(c => c.code === userCurrencies.from)?.flag} valyutasidan ${currencyCode} ${currencies.find(c => c.code === currencyCode)?.flag} valyutasiga kalkulyatsiya qilishni tanladingiz. Iltimos, miqdorni kiriting:\n\n/change_currency - valyutani o'zgartirish`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: [] } // Toza markup bilan
            });
        }
    }
};

export const handleCurrencyPagination = async (bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery, step: 'from' | 'to', page: number) => {
    const messageId = callbackQuery.message?.message_id;
    const chatId = callbackQuery.message?.chat.id;

    if (messageId && chatId) {
        await bot.editMessageReplyMarkup(createCurrencyOptions(step, page).reply_markup, {
            chat_id: chatId,
            message_id: messageId
        });
    }
};

export const handleCurrencyConversion = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    const userCurrencies = userCurrencyMap.get(chatId);
    if (userCurrencies && userCurrencies.from && userCurrencies.to) {
        const amount = parseFloat(text);

        if (isNaN(amount)) {
            const sentMessage = await bot.sendMessage(chatId, 'Iltimos, to\'g\'ri miqdorni kiriting:');
            addMessageToContext(chatId, sentMessage.message_id);
            return;
        }

        try {
            bot.sendChatAction(chatId, 'typing');

            const response = await axios.get(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/${userCurrencies.from}`);
            const rate = response.data.conversion_rates[userCurrencies.to];
            const convertedAmount = (amount * rate).toFixed(2);

            const sentMessage = await bot.sendMessage(chatId, `${amount} ${userCurrencies.from} ${currencies.find(c => c.code === userCurrencies.from)?.flag} = ${convertedAmount} ${userCurrencies.to} ${currencies.find(c => c.code === userCurrencies.to)?.flag}`, {
                reply_markup: {
                    keyboard: [
                        [{ text: "Bot turini o'zgartirish" }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                }
            });
            addMessageToContext(chatId, sentMessage.message_id);
        } catch (error) {
            const sentMessage = await bot.sendMessage(chatId, 'Valyuta kurslarini olishda xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko\'ring.', {
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
    } else {
        const sentMessage = await bot.sendMessage(chatId, 'Iltimos, avval valyutalarni tanlang.');
        addMessageToContext(chatId, sentMessage.message_id);
    }
};


export const handleChangeCurrency = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  userCurrencyMap.delete(chatId);
  await handleCurrencyCommand(bot, chatId);
};