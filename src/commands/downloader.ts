import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const FILE_SIZE_LIMIT_MB = 50;  // Telegram fayl hajmi cheklovi
const KEYFILEPATH = 'C:/Users/user/Desktop/my/universal/universal-bot-430012-3fa36617a0e3.json';  // To'liq yo'lni kiriting
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Google Drive API xizmatini sozlash
const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES
});

const drive = google.drive({ version: 'v3', auth });

export const handleDownloadCommand = (bot: TelegramBot, chatId: number) => {
    bot.sendMessage(chatId, 'Iltimos, yuklab olmoqchi bo\'lgan video yoki rasmning URL manzilini yuboring.');
};

const downloadVideo = async (url: string, output: string): Promise<void> => {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
        const stream = response.data.pipe(fs.createWriteStream(output));
        stream.on('finish', () => resolve());
        stream.on('error', (error) => reject(error));
    });
};

const getVideoSizeInMB = (filePath: string): number => {
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    return fileSizeInBytes / (1024 * 1024);  // Convert to MB
};

const uploadFileToGoogleDrive = async (filePath: string): Promise<string> => {
    const fileName = path.basename(filePath);
    const fileMetadata = {
        name: fileName
    };
    const media = {
        mimeType: 'video/mp4', // Fayl turini o'zgartiring
        body: fs.createReadStream(filePath)
    };

    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id'
    });

    const fileId = response.data.id;
    return fileId;
};

const getFilePublicLink = async (fileId: string): Promise<string> => {
    await drive.permissions.create({
        fileId: fileId,
        requestBody: {
            role: 'reader',
            type: 'anyone'
        }
    });

    const result = await drive.files.get({
        fileId: fileId,
        fields: 'webViewLink'
    });

    return result.data.webViewLink;
};

export const handleMediaUrl = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const url = msg.text;

    if (url && url.startsWith("http") && (url.includes("youtube.com") || url.includes("youtu.be"))) {
        bot.sendMessage(chatId, 'Videoni yuklab olmoqda, biroz kuting...');

        try {
            const videoId = extractVideoId(url);
            console.log('videoId:', videoId);
            if (!videoId) {
                throw new Error('Yaroqsiz YouTube URL. Iltimos, to\'g\'ri URL kiriting.');
            }

            const apiResponse = await axios.get('https://yt-api.p.rapidapi.com/dl', {
                params: { id: videoId },
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'yt-api.p.rapidapi.com'
                }
            });

            console.log('API Response:', apiResponse.data);  // Javobni konsolga chiqarish

            if (apiResponse.data.status === 'fail') {
                throw new Error(apiResponse.data.error);
            }

            const downloadUrl = apiResponse.data.downloadUrl || apiResponse.data.formats?.[0]?.url;
            const title = apiResponse.data.title;

            if (!downloadUrl || !title) {
                throw new Error('Invalid API response');
            }

            const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
            const output = path.resolve(__dirname, `${sanitizedTitle}.mp4`);

            await downloadVideo(downloadUrl, output);

            const fileSizeMB = getVideoSizeInMB(output);
            if (fileSizeMB > FILE_SIZE_LIMIT_MB) {
                const fileId = await uploadFileToGoogleDrive(output);
                const fileLink = await getFilePublicLink(fileId);
                await bot.sendMessage(chatId, `Video hajmi ${FILE_SIZE_LIMIT_MB} MB dan katta.\nFaylni yuklab olish uchun havola: ${fileLink}`);
            } else {
                const botUsername = 'tg_multitask_bot';  // Bot username'ini o'zgartiring yoki dinamik tarzda oling
                await bot.sendMessage(chatId, "Yuklash yakunlandi. Videoni yubormoqda...");
                await bot.sendDocument(chatId, output, { caption: `Video yuklandi. @${botUsername}` });
            }

            fs.unlinkSync(output);  // Faylni serverdan o'chirish
        } catch (error) {
            bot.sendMessage(chatId, `Videoni yuklashda xatolik yuz berdi: ${error.message}. Iltimos, qaytadan urinib ko'ring.`);
            console.error('Error during video download:', error);
        }
    } else {
        bot.sendMessage(chatId, 'Yaroqsiz URL. Iltimos, to\'g\'ri YouTube URL kiriting.');
    }
};

const extractVideoId = (url: string): string | null => {
    console.log('URL:', url);

    try {
        const urlObj = new URL(url);
        console.log('urlObj:', urlObj);

        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        } else if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com' || urlObj.hostname === 'm.youtube.com') {
            const videoId = urlObj.searchParams.get('v');
            if (videoId) return videoId;
            const shortsId = urlObj.pathname.split('/shorts/')[1];
            if (shortsId) return shortsId;
        } else if (urlObj.pathname.includes('/embed/')) {
            return urlObj.pathname.split('/embed/')[1];
        } else if (urlObj.pathname.includes('/v/')) {
            return urlObj.pathname.split('/v/')[1];
        } else {
            const siParam = urlObj.searchParams.get('si');
            if (siParam) return siParam;
            const match = url.match(/(?:youtube\.com\/\S*(?:(?:\/e(?:mbed))?\/|v\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{6,11})/);
            return (match && match[1]) ? match[1] : null;
        }
    } catch (error) {
        console.error('Invalid URL:', error);
        return null;
    }
};
