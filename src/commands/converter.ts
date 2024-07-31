import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { user } from '..';

dotenv.config();

const ZAMZAR_API_KEY = process.env.ZAMZAR_API_KEY;
const ZAMZAR_API_URL = 'https://sandbox.zamzar.com/v1';

if (!ZAMZAR_API_KEY) {
    throw new Error('ZAMZAR_API_KEY is not defined in environment variables');
}

const userFileMap = new Map<number, { fileId: string, fileName: string, fileType: string }>();


export const handleConvertCommand = async (bot: TelegramBot, chatId: number) => {
    const sentMessage = await bot.sendMessage(chatId, 'Please send the file you want to convert.', {
        reply_markup: {
            keyboard: [
                [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        },
    });
};

const getConversionFormats = async (fileType: string) => {
    try {
        const response = await axios.get(`${ZAMZAR_API_URL}/formats/${fileType}`, {
            auth: {
                username: ZAMZAR_API_KEY,
                password: ''
            }
        });
        return response.data.targets ? response.data.targets : [];
    } catch (error) {
        console.error(`Error fetching conversion formats for ${fileType}:`, error.message);
        throw error;
    }
};

const uploadFileToZamzar = async (filePath: string, targetFormat: string) => {
    
    try {
        const formData = new FormData();
        formData.append('source_file', fs.createReadStream(filePath));
        formData.append('target_format', targetFormat);

        console.log('source_file:', filePath);
        console.log('target_format:', targetFormat);
        

        const response = await axios.post(`${ZAMZAR_API_URL}/jobs`, formData, {
            auth: {
                username: ZAMZAR_API_KEY,
                password: ''
            },
            headers: {
                ...formData.getHeaders()
            }
        });

        return response.data;
    } catch (error) {
        console.error(`Error uploading file to Zamzar:`, error.message);
        throw error;
    }
};

const downloadConvertedFile = async (fileUrl: string, outputPath: string) => {
    try {
        const response = await axios.get(fileUrl, {
            responseType: 'stream',
            auth: {
                username: ZAMZAR_API_KEY,
                password: ''
            }
        });

        return new Promise((resolve, reject) => {
            const stream = response.data.pipe(fs.createWriteStream(outputPath));
            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        });
    } catch (error) {
        console.error(`Error downloading converted file:`, error.message);
        throw error;
    }
};

function removeBaseUrl(url) {
    const baseUrl = "http://localhost:8081/file/bot7145108535:AAEWJdKKhRWfJZMy5rw_UnDkTgPXR4Ry-0g/";
    if (url.startsWith(baseUrl)) {
        return url.slice(baseUrl.length);
    }
    return url; // Agar URL boshlanish qismi mos kelmasa, asl URL-ni qaytaradi
}

export const handleFileConversion = async (bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    const targetFormat = data.split('_')[1];

    if (!chatId || !targetFormat) return;

    const fileInfo = userFileMap.get(chatId);
    if (!fileInfo) return;

    const { fileId, fileName, fileType } = fileInfo;

    const fileLink = await bot.getFileLink(fileId);
    
    const processingMessage = await bot.sendMessage(chatId, 'Processing the file, please wait...', {
        reply_markup: {
            remove_keyboard: true
        },
        reply_to_message_id: callbackQuery.message?.message_id
    });

    try {

        const uploadResponse = await uploadFileToZamzar(removeBaseUrl(fileLink), targetFormat);
        const jobId = uploadResponse.id;
        let jobResponse;

        // Polling the job status
        let jobStatus = uploadResponse.status;
        while (jobStatus !== 'successful') {
            jobResponse = await axios.get(`${ZAMZAR_API_URL}/jobs/${jobId}`, {
                auth: {
                    username: ZAMZAR_API_KEY,
                    password: ''
                }
            });
            jobStatus = jobResponse.data.status;
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay
        }

        const fileIdConverted = jobResponse.data.target_files[0].id;
        const fileDownloadUrl = `${ZAMZAR_API_URL}/files/${fileIdConverted}/content`;

        const outputPath = path.join(__dirname, 'tmp', `${path.basename(fileName, path.extname(fileName))}.${targetFormat}`);
        await downloadConvertedFile(fileDownloadUrl, outputPath);
        await bot.sendChatAction(chatId, 'upload_document');

        await bot.sendDocument(chatId, outputPath, {
            reply_markup: {
                keyboard: [
                    [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            caption: '🤖 @tg_multitask_bot',
            reply_to_message_id: callbackQuery.message?.message_id
        });

        // Delete the file from the server
        fs.unlink(outputPath, (err) => {
            if (err) console.error(`Failed to delete file: ${outputPath}`, err);
            else console.log(`Deleted file: ${outputPath}`);
        });
    } catch (error) {
        console.log('Error:', error);
        if (error.response?.status === 413) {
            await bot.sendMessage(chatId, 'The file is too large to convert. Please send a smaller file.', {
                reply_markup: {
                    keyboard: [
                        [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                },
                reply_to_message_id: callbackQuery.message?.message_id
            });
        } else {
            await bot.sendMessage(chatId, `Failed to convert file: ${error.message}`, {
                reply_markup: {
                    keyboard: [
                        [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                },
                reply_to_message_id: callbackQuery.message?.message_id
            });
        }
    } finally {
        // Delete the original file from the server
        fs.unlink(removeBaseUrl(fileLink), (err) => {
            if (err) console.error(`Failed to delete file: ${removeBaseUrl(fileLink)}`, err);
            else console.log(`Deleted file: ${removeBaseUrl(fileLink)}`);
        });
        await bot.deleteMessage(chatId, processingMessage.message_id.toString());
    }
};

export const handleDocumentMessage = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const fileId = msg.document?.file_id;
    const fileName = msg.document?.file_name;
    const mimeType = msg.document?.mime_type;

    if (!fileId || !fileName || !mimeType) {
        await bot.sendMessage(chatId, 'Please send a valid file.', {
            reply_markup: {
                keyboard: [
                    [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            reply_to_message_id: msg.message_id
        });
        return;
    }
    await bot.sendChatAction(chatId, 'typing');
    const fileType = fileName.split('.').pop();
    const availableFormats = await getConversionFormats(fileType);

    if (availableFormats.length === 0) {
        await bot.sendMessage(chatId, 'No available conversion formats for this file type.', {
            reply_markup: {
                keyboard: [
                    [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            reply_to_message_id: msg.message_id
        });
        return;
    }

    userFileMap.set(chatId, { fileId, fileName, fileType });

    const formatButtons = availableFormats.map((format: { name: string }) => ({ text: format.name.toUpperCase(), callback_data: `convert_${format.name}` }));
    const formatKeyboard = [];

    for (let i = 0; i < formatButtons.length; i += 3) {
        formatKeyboard.push(formatButtons.slice(i, i + 3));
    }

    await bot.sendMessage(chatId, `Fayl turi ${fileType.toUpperCase()}\nUni quyidagilarga konvertatsiyalash mumkin:`, {
        reply_markup: {
            inline_keyboard: formatKeyboard,
        },
        reply_to_message_id: msg.message_id
    });
};

// Yangi funksiya videolarni qayta ishlash uchun
export const handleVideoMessage = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const fileId = msg.video?.file_id || msg.video_note?.file_id
    const fileName = `${msg.video?.file_unique_id || msg.video_note?.file_unique_id}.mp4`;
    const mimeType = msg.video?.mime_type || 'video/mp4';

    if (!fileId || !fileName || !mimeType) {
        await bot.sendMessage(chatId, 'Please send a valid video.', {
            reply_markup: {
                keyboard: [
                    [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            reply_to_message_id: msg.message_id
        });
        return;
    }

    await bot.sendChatAction(chatId, 'typing');
    const fileType = fileName.split('.').pop();
    const availableFormats = await getConversionFormats(fileType);

    if (availableFormats.length === 0) {
        await bot.sendMessage(chatId, 'No available conversion formats for this video type.', {
            reply_markup: {
                keyboard: [
                    [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            reply_to_message_id: msg.message_id
        });
        return;
    }

    userFileMap.set(chatId, { fileId, fileName, fileType });

    const formatButtons = availableFormats.map((format: { name: string }) => ({ text: format.name.toUpperCase(), callback_data: `convert_${format.name}` }));
    const formatKeyboard = [];

    for (let i = 0; i < formatButtons.length; i += 3) {
        formatKeyboard.push(formatButtons.slice(i, i + 3));
    }

    await bot.sendMessage(chatId, `Video turi ${fileType.toUpperCase()}\nUni quyidagilarga konvertatsiyalash mumkin:`, {
        reply_markup: {
            inline_keyboard: formatKeyboard,
        },
        reply_to_message_id: msg.message_id
    });
};

export const handleAudioMessage = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const fileId = msg.audio?.file_id || msg.voice?.file_id;
    const fileName = `${msg.audio?.file_unique_id || msg.voice?.file_unique_id}.mp3`;
    const mimeType = msg.audio?.mime_type || 'audio/mpeg';

    if (!fileId || !fileName || !mimeType) {
        await bot.sendMessage(chatId, 'Please send a valid audio file.', {
            reply_markup: {
                keyboard: [
                    [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            reply_to_message_id: msg.message_id
        });
        return;
    }

    await bot.sendChatAction(chatId, 'typing');
    const fileType = fileName.split('.').pop();
    const availableFormats = await getConversionFormats(fileType);

    if (availableFormats.length === 0) {
        await bot.sendMessage(chatId, 'No available conversion formats for this audio type.', {
            reply_markup: {
                keyboard: [
                    [{ text: user.language.code === 'uz' ? 'Bot turini o\'zgartirish' : user.language.code === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            reply_to_message_id: msg.message_id
        });
        return;
    }

    userFileMap.set(chatId, { fileId, fileName, fileType });

    const formatButtons = availableFormats.map((format: { name: string }) => ({ text: format.name.toUpperCase(), callback_data: `convert_${format.name}` }));
    const formatKeyboard = [];

    for (let i = 0; i < formatButtons.length; i += 3) {
        formatKeyboard.push(formatButtons.slice(i, i + 3));
    }

    await bot.sendMessage(chatId, `Audio turi ${fileType.toUpperCase()}\nUni quyidagilarga konvertatsiyalash mumkin:`, {
        reply_markup: {
            inline_keyboard: formatKeyboard,
        },
        reply_to_message_id: msg.message_id
    });
};
