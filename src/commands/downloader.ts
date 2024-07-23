import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const FILE_SIZE_LIMIT_MB = 2000;  // Telegram file size limit
const MAX_RETRIES = 3;  // Retry limit
const TIMEOUT = 10000;  // 10 seconds timeout

if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY is not defined in environment variables');
}

interface UserMessageMap {
    [chatId: number]: number[];
}

const userMessageMap: UserMessageMap = {};

const addMessageToContext = (chatId: number, messageId: number): void => {
    const messages = userMessageMap[chatId] || [];
    messages.push(messageId);
    userMessageMap[chatId] = messages;
};

export const handleDownloadCommand = async (bot: TelegramBot, chatId: number): Promise<void> => {
    const sentMessage = await bot.sendMessage(chatId, 'Please send the URL of the video you want to download.', {
        reply_markup: {
            keyboard: [
                [{ text: "Bot turini o'zgartirish" }]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    });
    addMessageToContext(chatId, sentMessage.message_id);
};

const downloadVideo = async (url: string, output: string): Promise<void> => {
    
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: TIMEOUT
    });

    return new Promise((resolve, reject) => {
        
        const stream = response.data.pipe(fs.createWriteStream(output));
        stream.on('finish', () => resolve());
        stream.on('error', (error) => {
            console.error(`Error downloading video: ${error.message}`);
            reject(error);
        });
    });
};

const fetchFromApi = async (params: object, apiUrl: string, host: string, retries: number = MAX_RETRIES): Promise<any> => {
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            console.log(`Attempt ${attempt + 1} to fetch from ${apiUrl}`);
            
            const response = await axios.get(apiUrl, {
                params: params,
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': host
                },
                timeout: TIMEOUT,
                validateStatus: function (status) {
                    return status >= 200 && status < 300 || status === 429; // Resolve if status is 429
                }
            });

            if (response.status === 429) {
                throw new Error('API rate limit exceeded');
            }

            return response;
        } catch (error) {
            console.error(`Error on attempt ${attempt + 1}: ${error.message}`);
            if (error.message === 'API rate limit exceeded') {
                throw error;
            }
            if (attempt < retries - 1 && (error.code === 'ECONNABORTED' || error.response?.status === 504 || error.code === 'ECONNRESET')) {
                console.warn(`Retrying request to ${apiUrl} (${attempt + 1}/${retries})...`);
                continue;
            }
            console.error(`Failed request to ${apiUrl} after ${attempt + 1} attempts`);
            throw error;
        }
    }
};

export const handleMediaUrl = async (bot: TelegramBot, msg: TelegramBot.Message): Promise<void> => {
    const chatId = msg.chat.id;
    const url = msg.text;

    if (url && url.startsWith("http")) {
        const processingMessage = await bot.sendMessage(chatId, 'Processing the URL, please wait...', {
            reply_markup: {
                remove_keyboard: true
            }
        });
        addMessageToContext(chatId, processingMessage.message_id);

        try {
            const { title, isVideo, channel, formats } = await getYouTubeDownloadDetails(url);

            const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');

            if (isVideo) {
                await sendPaginatedFormats(bot, chatId, formats, title, channel, 1, msg);

                bot.on('callback_query', async (callbackQuery) => {
                    const data = callbackQuery.data;
                    const userId = callbackQuery.from.id;
                    const replyMessageId = callbackQuery.message?.message_id;

                    if (data.startsWith('page_')) {
                        const page = parseInt(data.split('_')[1], 10);
                        await sendPaginatedFormats(bot, chatId, formats, title, channel, page, msg);
                    } else if (data.startsWith('format_')) {
                        const formatIndex = parseInt(data.split('_')[1], 10);
                        const formatUrl = formats[formatIndex].url;
                        const formatSize = formats[formatIndex].size;
                        
                        if (replyMessageId) {
                            await bot.deleteMessage(userId, replyMessageId.toString());
                        }

                        try {
                            await processAndSendMedia(bot, chatId, formatUrl, `${sanitizedTitle}.mp4`, 'upload_video', 'Video', formatSize);
                        } catch (error) {
                            await handleError(bot, chatId, `Failed to process media: ${error.message}`);
                        }

                        await bot.deleteMessage(chatId, processingMessage.message_id.toString());
                    }
                });
            }
        } catch (error) {
            await handleError(bot, chatId, error.message, processingMessage.message_id);
        }
    } else {
        bot.sendMessage(chatId, 'Invalid URL. Please enter a correct YouTube URL.', {
            reply_markup: {
                keyboard: [
                    [{ text: "Bot turini o'zgartirish" }]
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            reply_to_message_id: msg.message_id
        });
    }
};

const getYouTubeDownloadDetails = async (url: string): Promise<{ title: string, channel: string, isVideo: boolean, formats: any[] }> => {
    const videoId = extractVideoId(url);
    if (!videoId) {
        throw new Error('Invalid YouTube URL. Please enter a correct URL.');
    }

    const apiResponse = await fetchFromApi({ id: videoId }, 'https://yt-api.p.rapidapi.com/dl', 'yt-api.p.rapidapi.com');
    if (!apiResponse.data || apiResponse.data.status !== 'OK') {
        throw new Error('Invalid API response');
    }
    
    const title = apiResponse.data.title;
    const channel = apiResponse.data.channelTitle;
    const allFormats = [
        ...apiResponse.data.formats.map((format: any) => ({
            url: format.url,
            qualityLabel: format.qualityLabel,
            quality: format.quality,
            mimeType: format.mimeType,
            size: format.contentLength
        })),
        ...apiResponse.data.adaptiveFormats.map((format: any) => ({
            url: format.url,
            qualityLabel: format.qualityLabel,
            quality: format.quality,
            mimeType: format.mimeType,
            size: format.contentLength
        }))
    ];

    // Filter out duplicate quality formats
    const uniqueFormats = allFormats.reduce((acc: any[], current) => {
        const x = acc.find(item => item.quality === current.quality);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    if (!uniqueFormats.length) {
        throw new Error('No available formats found');
    }

    const isVideo = true;

    
    return { title, channel, isVideo, formats: uniqueFormats.reverse() };
};

const sendPaginatedFormats = async (bot: TelegramBot, chatId: number, formats: any[], title: string, channel: string, page: number, msg: TelegramBot.Message): Promise<void> => {
    const itemsPerPage = 18;
    const offset = (page - 1) * itemsPerPage;
    const paginatedFormats = formats.slice(offset, offset + itemsPerPage);

    

    const formatButtons = paginatedFormats.map((format, index) => ({
        text: `${format.qualityLabel ? format.qualityLabel : format.quality}`,
        callback_data: `format_${offset + index}`
    }));

    const inlineKeyboard = [];
    for (let i = 0; i < formatButtons.length; i += 3) {
        inlineKeyboard.push(formatButtons.slice(i, i + 3));
    }

    const paginationButtons = [];
    if (page > 1) {
        paginationButtons.push({ text: '⬅️ Previous', callback_data: `page_${page - 1}` });
    }
    if (offset + itemsPerPage < formats.length) {
        paginationButtons.push({ text: 'Next ➡️', callback_data: `page_${page + 1}` });
    }
    if (paginationButtons.length > 0) {
        inlineKeyboard.push(paginationButtons);
    }

    await bot.sendMessage(chatId, `📹${title}\n👤${channel}\n\n${
        paginatedFormats.map(format => `✅ ${format.qualityLabel ? format.qualityLabel : format.quality} ${(format.size/1048576).toFixed(0)} MB`).join('\n')
        + '\n\n' + 'Select a format ↓'
    }`, {
        reply_markup: {
            inline_keyboard: inlineKeyboard
        },
        reply_to_message_id: msg.message_id
    });
};

const processAndSendMedia = async (bot: TelegramBot, chatId: number, downloadUrl: string, outputFileName: string, action: 'upload_video' | 'upload_audio', mediaType: 'Video' | 'Audio', size: any): Promise<void> => {
    const output = path.resolve(__dirname, outputFileName);

    if (size/1048576 > FILE_SIZE_LIMIT_MB) {
        await bot.sendMessage(chatId, `The ${mediaType.toLowerCase()} size is larger than ${FILE_SIZE_LIMIT_MB} MB. Please upload another ${mediaType.toLowerCase()}.`, {
            reply_markup: {
                keyboard: [
                    [{ text: "Bot turini o'zgartirish" }]
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        });
    } else {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                console.log('mediaType:', mediaType);
                console.log('downloadUrl:', downloadUrl);
                
                if (mediaType === 'Video') {
                    await downloadVideo(downloadUrl, output);
                }
                break;
            } catch (error) {
                console.log('error:', error);
                
                if (attempt < MAX_RETRIES - 1) {
                    console.warn(`Retrying download (${attempt + 1}/${MAX_RETRIES})...`);
                } else {
                    console.error(`Failed to download ${mediaType.toLowerCase()}: ${error.message}`);
                    throw error;
                }
            }
        }

        await bot.sendChatAction(chatId, action);
        try {
            if (mediaType === 'Video') {
                await bot.sendVideo(chatId, output, {
                    caption: `Video uploaded. @tg_multitask_bot`,
                    reply_markup: {
                        keyboard: [
                            [{ text: "Bot turini o'zgartirish" }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    }
                });
            }
        } catch (error) {
            console.error(`Failed to send ${mediaType.toLowerCase()}: ${error.message}`);
            throw error;
        } finally {
            fs.unlinkSync(output);  // Delete the file from the server
        }
    }
};

const handleError = async (bot: TelegramBot, chatId: number, errorMessage: string, processingMessageId?: number): Promise<void> => {
    await bot.sendMessage(chatId, `Error: ${errorMessage}. Please try again.`, {
        reply_markup: {
            keyboard: [
                [{ text: "Bot turini o'zgartirish" }]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    });
    if (processingMessageId) {
        await bot.deleteMessage(chatId, processingMessageId.toString());
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
