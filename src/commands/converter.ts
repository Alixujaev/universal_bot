import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const ZAMZAR_API_KEY = process.env.ZAMZAR_API_KEY;
const ZAMZAR_API_URL = 'https://sandbox.zamzar.com/v1';

if (!ZAMZAR_API_KEY) {
    throw new Error('ZAMZAR_API_KEY is not defined in environment variables');
}

const userMessageMap = new Map<number, number[]>();
const userFileMap = new Map<number, { fileId: string, fileName: string, fileType: string }>();

const addMessageToContext = (chatId: number, messageId: number) => {
    const messages = userMessageMap.get(chatId) || [];
    messages.push(messageId);
    userMessageMap.set(chatId, messages);
};

export const handleConvertCommand = async (bot: TelegramBot, chatId: number) => {
    const sentMessage = await bot.sendMessage(chatId, 'Please send the file you want to convert.');
    addMessageToContext(chatId, sentMessage.message_id);
};

const getConversionFormats = async (fileType: string) => {
    const response = await axios.get(`${ZAMZAR_API_URL}/formats`, {
        auth: {
            username: ZAMZAR_API_KEY,
            password: ''
        }
    });

    // Find the format data for the given file type
    console.log('fileType:', fileType);
    
    const formatData = response.data.data.find((format: any) => format.name === fileType.toLowerCase());
    return formatData ? formatData.targets : [];
};

const uploadFileToZamzar = async (fileLink: string, targetFormat: string) => {
    const response = await axios.post(`${ZAMZAR_API_URL}/jobs`, {
        source_url: fileLink,
        target_format: targetFormat
    }, {
        auth: {
            username: ZAMZAR_API_KEY,
            password: ''
        }
    });

    return response.data;
};

const downloadConvertedFile = async (fileUrl: string, outputPath: string) => {
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
};

export const handleFileConversion = async (bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    const targetFormat = data.split('_')[1];

    if (!chatId || !targetFormat) return;

    const fileInfo = userFileMap.get(chatId);
    if (!fileInfo) return;

    const { fileId, fileName, fileType } = fileInfo;

    const fileLink = await bot.getFileLink(fileId);
    const processingMessage = await bot.sendMessage(chatId, 'Processing the file, please wait...');
    addMessageToContext(chatId, processingMessage.message_id);

    try {
        const uploadResponse = await uploadFileToZamzar(fileLink, targetFormat);
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

        const outputPath = `/tmp/${path.basename(fileName, path.extname(fileName))}.${targetFormat}`;
        await downloadConvertedFile(fileDownloadUrl, outputPath);

        await bot.sendDocument(chatId, outputPath);
    } catch (error) {
        await bot.sendMessage(chatId, `Failed to convert file: ${error.message}`);
    } finally {
        await bot.deleteMessage(chatId, processingMessage.message_id.toString());
    }
};

export const handleDocumentMessage = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const fileId = msg.document?.file_id;
    const fileName = msg.document?.file_name;
    const mimeType = msg.document?.mime_type;

    

    if (!fileId || !fileName || !mimeType) {
        await bot.sendMessage(chatId, 'Please send a valid file.');
        return;
    }

    const fileType = fileName.split('.')[1];
    const availableFormats = await getConversionFormats(fileType);

    if (availableFormats.length === 0) {
        await bot.sendMessage(chatId, 'No available conversion formats for this file type.');
        return;
    }

    userFileMap.set(chatId, { fileId, fileName, fileType });

    const formatButtons = availableFormats.map((format: {name: string}) => ({ text: format.name.toUpperCase(), callback_data: `convert_${format}` }));
    const formatKeyboard = [];

    for (let i = 0; i < formatButtons.length; i += 3) {
        formatKeyboard.push(formatButtons.slice(i, i + 3));
    }

    await bot.sendMessage(chatId, `Fayl turi ${fileType.toUpperCase()}\nUni quyidagilarga konvertatsiyalash mumkin:`, {
        reply_markup: {
            inline_keyboard: formatKeyboard
        }
    });
};
