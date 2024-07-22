import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const handleVoiceToText = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const fileId = msg.voice?.file_id;

    if (!fileId) {
        await bot.sendMessage(chatId, 'Audio faylni yuboring.');
        return;
    }

    const fileLink = await bot.getFileLink(fileId);
    const fileResponse = await axios.get(fileLink, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(fileResponse.data, 'binary');

    fs.writeFileSync('audio.ogg', buffer);

    const audio = fs.createReadStream('audio.ogg');
    const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: audio,
    });

    const transcription = response.text.split('\n').map(result => result.trim()).join('\n');
    await bot.sendMessage(chatId, `Transkriptiya:\n${transcription}`);
};

export const handleTextToVoice = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) {
        await bot.sendMessage(chatId, 'Matnni kiriting.');
        return;
    }

    const speechFile = path.resolve('./speech.mp3');
    const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(speechFile, buffer);
    await bot.sendVoice(chatId, speechFile);
};
