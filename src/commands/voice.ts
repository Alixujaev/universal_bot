import TelegramBot from 'node-telegram-bot-api';
import OpenAI from "openai";
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { sendMessage } from '../utils/mainMenu';
import { user } from '..';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


export const handleTextToVoiceCommand = async (bot: TelegramBot, chatId: number): Promise<void> => {
    await sendMessage(chatId, bot, "Istalgan matnni yuboring va ovozga aylantiring. \n\nHajm: 500 ta harf \nOvoz tili: English 🇺🇸 \nOvoz tilini o'zgartirish uchun: /vip", {
        reply_markup: {
          keyboard: [
            [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
        ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    })
};

// Matnni ovozga aylantirish
export const handleTextToVoice = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const text = msg.text;
  const chatId = msg.chat.id;

  if(text === '/vip') return

  if (!text) {
    await bot.sendMessage(chatId, 'Please provide text to convert to voice.');
    return;
  }

  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy', // Istalgan ovoz variantini tanlashingiz mumkin
      input: text,
    });

    const audioBuffer = Buffer.from(await mp3.arrayBuffer());
    const outputPath = path.join(__dirname, 'tmp', `${new Date().getTime()}.mp3`);
    fs.writeFileSync(outputPath, audioBuffer, 'binary');

    await bot.sendVoice(chatId, outputPath, {}, {
      filename: 'output.mp3',
      contentType: 'audio/mpeg',
    });

    // Faylni serverdan o'chirish
    fs.unlinkSync(outputPath);
  } catch (error) {
    console.error('Error synthesizing text:', error);
    await bot.sendMessage(chatId, 'Failed to convert text to voice.');
  }
};

