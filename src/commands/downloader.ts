import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';

dotenv.config();

// Media yuklab olish komandasi
export const handleDownloadCommand = (bot: TelegramBot, chatId: number) => {
    bot.sendMessage(chatId, 'Iltimos, yuklab olmoqchi bo\'lgan video yoki rasmning URL manzilini yuboring.');
};

// Instagram media yuklab olish funksiyasi
const downloadInstagramMedia = async (url: string): Promise<string> => {
    try {
        const response = await axios.get('https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index', {
            params: { url },
            headers: {
                'x-rapidapi-host': 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com',
                'x-rapidapi-key': process.env.RAPIDAPI_KEY // RapidAPI'dan olingan API kalitni qo'shing
            }
        });
        if (response.data && response.data.media) {
            return response.data.media;
        } else {
            throw new Error('Instagram uchun yuklab olish URL qaytarilmadi');
        }
    } catch (error) {
        console.error('Error downloading Instagram media:', error);
        throw new Error('Instagram dan yuklab olish amalga oshirishda xato yuz berdi');
    }
};

// TikTok media yuklab olish funksiyasi
const downloadTikTokMedia = async (url: string): Promise<string> => {
    try {
        const response = await axios.get('https://tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com/', {
            params: { url },
            headers: {
                'x-rapidapi-host': 'tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com',
                'x-rapidapi-key': process.env.RAPIDAPI_KEY // RapidAPI'dan olingan API kalitni qo'shing
            }
        });
        if (response.data && response.data.video) {
            return response.data.video;
        } else {
            throw new Error('TikTok uchun yuklab olish URL qaytarilmadi');
        }
    } catch (error) {
        console.error('Error downloading TikTok media:', error);
        throw new Error('TikTok dan yuklab olish amalga oshirishda xato yuz berdi');
    }
};

// URL ni tekshirish va media yuklab olish funksiyasi
export const downloadMedia = async (url: string): Promise<string> => {
    const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s]+/;
    const tiktokRegex = /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/[^\s]+/;

    if (instagramRegex.test(url)) {
        return await downloadInstagramMedia(url);
    } else if (tiktokRegex.test(url)) {
        return await downloadTikTokMedia(url);
    } else {
        throw new Error('Yaroqsiz URL. Iltimos, Instagram yoki TikTok URL kiriting.');
    }
};

// Media URL ni boshqarish funksiyasi
export const handleMediaUrl = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const url = msg.text;

    if (url) {
        try {
            bot.sendChatAction(chatId, 'upload_video');
            const mediaUrl = await downloadMedia(url);

            // Vaqtinchalik fayl yaratish
            const tempFile = tmp.fileSync({ postfix: '.mp4' }); // Fayl nomini qisqartirish
            const writer = fs.createWriteStream(tempFile.name);

            // Media yuklab olish
            const response = await axios({
                url: mediaUrl,
                method: 'GET',
                responseType: 'stream'
            });

            response.data.pipe(writer);

            writer.on('finish', async () => {
                await bot.sendVideo(chatId, tempFile.name);
                tempFile.removeCallback(); // Faylni yuborgandan so'ng uni o'chirish
            });

            writer.on('error', () => {
                throw new Error('Media yuklab olishda xato yuz berdi');
            });
        } catch (error) {
            bot.sendMessage(chatId, `Xato yuz berdi: ${error.message}`);
        }
    } else {
        bot.sendMessage(chatId, 'Iltimos, to\'g\'ri URL kiriting.');
    }
};
