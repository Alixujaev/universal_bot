import TelegramBot from 'node-telegram-bot-api';
import { translateMessage } from "./systemLangs";

const userMessageMap = new Map<number, number[]>();

export const mainMenuOptions = (chatId: number) => {
  const translate = (text: string) => translateMessage(chatId, text);
  return {
      reply_markup: {
          keyboard: [
              [{ text: translate('Translation') }, { text: translate('Download') }],
              [{ text: translate('Currency Calculator') }, { text: translate('File Conversion') }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
      },
  };
};

export const clearPreviousMessages = async (chatId: number, bot: TelegramBot) => {
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

export const addMessageToContext = (chatId: number, messageId: number) => {
  const messages = userMessageMap.get(chatId) || [];
  messages.push(messageId);
  userMessageMap.set(chatId, messages);
};


export const sendMessage = async (chatId: number, bot: TelegramBot, text: string, options?: TelegramBot.SendMessageOptions) => {
  const translatedText = translateMessage(chatId, text);
  const message = await bot.sendMessage(chatId, translatedText, options);
  addMessageToContext(chatId, message.message_id);
};