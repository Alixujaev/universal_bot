import TelegramBot from 'node-telegram-bot-api';
import OpenAI from "openai";
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { sendMessage } from '../utils/mainMenu';
import { user } from '..';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


export const handleTextToVoiceCommand = async (bot: TelegramBot, chatId: number): Promise<void> => {
    await sendMessage(chatId, bot, 'Text yubor', {
        reply_markup: {
            keyboard: [
                [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
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

export const handleVoiceToText = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const fileId = msg.voice?.file_id || msg.audio?.file_id;

    if (!fileId) {
      await bot.sendMessage(chatId, 'Please send a valid voice message.');
      return;
    }
  
    // const fileLink = await bot.getFileLink(fileId);
    // const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
    // const audioBuffer = Buffer.from(response.data, 'binary');
    // const tempFilePath = path.join(__dirname, 'tmp', `${chatId}.ogg`);
    // fs.writeFileSync(tempFilePath, audioBuffer);
  
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream('C://Users/user/Desktop/my/universal/src/audio_2024-08-01_03-51-27.ogg'),
        model: 'whisper-1',
      });
  
      await bot.sendMessage(chatId, `Transcription: ${transcription.text}`);
    } catch (error) {
      console.error('Error transcribing audio:', error);
      await bot.sendMessage(chatId, 'Failed to transcribe the audio.');
    } finally {
    //   fs.unlinkSync(tempFilePath); // Temp faylni o'chirish
    }
}
