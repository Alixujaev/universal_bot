import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const FILE_SIZE_LIMIT_MB = 50;  // Telegram file size limit
const MAX_RETRIES = 3;  // Retry limit

const userMessageMap = new Map<number, number[]>();

const addMessageToContext = (chatId: number, messageId: number) => {
    const messages = userMessageMap.get(chatId) || [];
    messages.push(messageId);
    userMessageMap.set(chatId, messages);
};

export const handleDownloadCommand = async (bot: TelegramBot, chatId: number) => {
    const sentMessage = await bot.sendMessage(chatId, 'Please send the URL of the video or image you want to download.', {
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
    });

    return new Promise((resolve, reject) => {
        const stream = response.data.pipe(fs.createWriteStream(output));
        stream.on('finish', () => resolve());
        stream.on('error', (error) => reject(error));
    });
};

const downloadAudio = async (url: string, output: string): Promise<void> => {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
    });

    return fs.promises.writeFile(output, response.data);
};

const getFileSizeInMB = (filePath: string): number => {
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    return fileSizeInBytes / (1024 * 1024);  // Convert to MB
};

const fetchFromApi = async (params: object, apiUrl: string, host: string, retries: number = MAX_RETRIES): Promise<any> => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await axios.get(apiUrl, {
                params: params,
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': host
                }
            });
        } catch (error) {
            if (attempt < retries - 1 && (error.code === 'ECONNABORTED' || error.response?.status === 504)) {
                console.warn(`Retrying request to ${apiUrl} (${attempt + 1}/${retries})...`);
                continue;
            }
            throw error;
        }
    }
};

export const handleMediaUrl = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const url = msg.text;

    if (url && url.startsWith("http")) {
        const processingMessage = await bot.sendMessage(chatId, 'Processing the URL, please wait...', {
            reply_markup: {
                keyboard: [
                    [{ text: "Bot turini o'zgartirish" }]
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        });
        addMessageToContext(chatId, processingMessage.message_id);

        try {
            let downloadUrl: string | null = null;
            let title: string | null = null;
            let isVideo = false;

            if (url.includes("youtube.com") || url.includes("youtu.be")) {
                const videoId = extractVideoId(url);
                console.log('videoId:', videoId);
                if (!videoId) {
                    throw new Error('Invalid YouTube URL. Please enter a correct URL.');
                }

                let apiResponse;
                apiResponse = await fetchFromApi({ videoId: videoId }, 'https://youtube-media-downloader.p.rapidapi.com/v2/video/details', 'youtube-media-downloader.p.rapidapi.com');

                console.log('API Response:', apiResponse.data);  // Log the response

                if (!apiResponse.data.status || apiResponse.data.errorId !== 'Success') {
                    throw new Error('Invalid API response');
                }

                downloadUrl = apiResponse.data.videos.items[0].url;
                title = apiResponse.data.title;
                isVideo = true;

                if (!downloadUrl || !title) {
                    throw new Error('Invalid API response');
                }
            } else if (url.includes("instagram.com")) {
                const isStory = url.includes("/stories/");
                let apiResponse;

                try {
                    apiResponse = await fetchFromApi({ url: url }, 'https://instagram-downloader.p.rapidapi.com/index', 'instagram-downloader.p.rapidapi.com');
                } catch (error) {
                    console.error('Primary API failed:', error);
                    apiResponse = await fetchFromApi({ url: url }, 'https://instagram-downloader-download-photo-video-reels-igtv.p.rapidapi.com/data', 'instagram-downloader-download-photo-video-reels-igtv.p.rapidapi.com');
                }

                console.log('API Response:', apiResponse.data);  // Log the response

                if (isStory) {
                    if (!apiResponse.data.result || !apiResponse.data.result.video_url) {
                        throw new Error('Invalid API response');
                    }
                    downloadUrl = apiResponse.data.result.video_url;
                    title = apiResponse.data.result.username || 'instagram_story';
                    isVideo = true;
                } else {
                    if (!apiResponse.data.result || !apiResponse.data.result.video_url) {
                        throw new Error('Invalid API response');
                    }
                    downloadUrl = apiResponse.data.result.video_url;
                    title = apiResponse.data.result.username || 'instagram_video';
                    isVideo = true;
                }

                if (!downloadUrl || !title) {
                    throw new Error('Invalid API response');
                }
            } else if (url.match(/\.(jpeg|jpg|gif|png)$/) != null) {
                await bot.sendPhoto(chatId, url, {
                    reply_markup: {
                        keyboard: [
                            [{ text: "Bot turini o'zgartirish" }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    }
                });
                return;
            } else {
                throw new Error('Invalid URL. Please enter a correct URL.');
            }

            const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');

            if (isVideo) {
                await bot.sendMessage(chatId, 'Do you want the video or just the audio (MP3)?', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Video', callback_data: 'video' },
                                { text: 'Audio', callback_data: 'audio' }
                            ]
                        ]
                    }
                });

                bot.once('callback_query', async (callbackQuery) => {
                    const action = callbackQuery.data;
                    const userId = callbackQuery.from.id;
                    const replyMessageId = callbackQuery.message?.message_id;

                    if (replyMessageId) {
                        await bot.deleteMessage(userId, replyMessageId.toString());
                    }

                    if (action === 'video') {
                        const output = path.resolve(__dirname, `${sanitizedTitle}.mp4`);

                        await downloadVideo(downloadUrl, output);

                        const fileSizeMB = getFileSizeInMB(output);
                        if (fileSizeMB > FILE_SIZE_LIMIT_MB) {
                            await bot.sendMessage(chatId, `The video size is larger than ${FILE_SIZE_LIMIT_MB} MB. Please upload another video.`, {
                                reply_markup: {
                                    keyboard: [
                                        [{ text: "Bot turini o'zgartirish" }]
                                    ],
                                    resize_keyboard: true,
                                    one_time_keyboard: false
                                }
                            });
                        } else {
                            await bot.sendChatAction(chatId, 'upload_video');
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

                        fs.unlinkSync(output);  // Delete the file from the server
                    } else if (action === 'audio') {
                        const output = path.resolve(__dirname, `${sanitizedTitle}.mp3`);

                        await downloadAudio(downloadUrl, output);

                        const fileSizeMB = getFileSizeInMB(output);
                        if (fileSizeMB > FILE_SIZE_LIMIT_MB) {
                            await bot.sendMessage(chatId, `The audio size is larger than ${FILE_SIZE_LIMIT_MB} MB. Please upload another audio.`, {
                                reply_markup: {
                                    keyboard: [
                                        [{ text: "Bot turini o'zgartirish" }]
                                    ],
                                    resize_keyboard: true,
                                    one_time_keyboard: false
                                }
                            });
                        } else {
                            await bot.sendChatAction(chatId, 'upload_audio');
                            await bot.sendAudio(chatId, output, {
                                caption: `Audio uploaded. @tg_multitask_bot`,
                                reply_markup: {
                                    keyboard: [
                                        [{ text: "Bot turini o'zgartirish" }]
                                    ],
                                    resize_keyboard: true,
                                    one_time_keyboard: false
                                }
                            });
                        }

                        fs.unlinkSync(output);  // Delete the file from the server
                    }

                    await bot.deleteMessage(chatId, processingMessage.message_id.toString());
                });
            }
        } catch (error) {
            bot.sendMessage(chatId, `Error downloading the video: ${error.message}. Please try again.`, {
                reply_markup: {
                    keyboard: [
                        [{ text: "Bot turini o'zgartirish" }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                }
            });
            await bot.deleteMessage(chatId, processingMessage.message_id.toString());
            console.error('Error during video download:', error);
        }
    } else {
        bot.sendMessage(chatId, 'Invalid URL. Please enter a correct YouTube or Instagram URL.', {
            reply_markup: {
                keyboard: [
                    [{ text: "Bot turini o'zgartirish" }]
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        });
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
