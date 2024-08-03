import TelegramBot from 'node-telegram-bot-api';
import { translateMessage } from "./systemLangs";
import {user} from "..";
const userMessageMap = new Map<number, number[]>();

export const mainMenuOptions = () => {
  const translate = (text: string) => translateMessage(user.language.code, text);
  
  return {
      reply_markup: {
          keyboard: [
              [{ text: translate('Translation') }, { text: translate('Download') }],
              [{ text: translate('Currency Calculator') }, { text: translate('File Conversion') }],
              [{ text: translate('Text to voice') }],
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
  const translatedText = translateMessage(user.language.code, text);
  
  await bot.sendMessage(chatId, translatedText, options);
};