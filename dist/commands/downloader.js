"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMediaUrl = exports.handleDownloadCommand = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const FILE_SIZE_LIMIT_MB = 50; // Telegram file size limit
const MAX_RETRIES = 3; // Retry limit
const TIMEOUT = 10000; // 10 seconds timeout
if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY is not defined in environment variables');
}
const userMessageMap = {};
const addMessageToContext = (chatId, messageId) => {
    const messages = userMessageMap[chatId] || [];
    messages.push(messageId);
    userMessageMap[chatId] = messages;
};
const handleDownloadCommand = async (bot, chatId) => {
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
exports.handleDownloadCommand = handleDownloadCommand;
const downloadVideo = async (url, output) => {
    console.log(`Downloading video: ${url} to ${output}`);
    const response = await (0, axios_1.default)({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: TIMEOUT
    });
    return new Promise((resolve, reject) => {
        console.log(`Downloading video: ${url} to ${output}`);
        const stream = response.data.pipe(fs_1.default.createWriteStream(output));
        stream.on('finish', () => resolve());
        stream.on('error', (error) => {
            console.error(`Error downloading video: ${error.message}`);
            reject(error);
        });
    });
};
const downloadAudio = async (url, output) => {
    const response = await (0, axios_1.default)({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        timeout: TIMEOUT
    });
    await fs_1.default.promises.writeFile(output, response.data);
};
const getFileSizeInMB = (filePath) => {
    const stats = fs_1.default.statSync(filePath);
    return stats.size / (1024 * 1024); // Convert to MB
};
const fetchFromApi = async (params, apiUrl, host, retries = MAX_RETRIES) => {
    console.log(`Fetching from API: ${apiUrl}`);
    console.log(`Params: ${JSON.stringify(params)}`);
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            console.log(`Attempt ${attempt + 1} to fetch from ${apiUrl}`);
            const response = await axios_1.default.get(apiUrl, {
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
            console.log(`Response received: ${response.status}`);
            return response;
        }
        catch (error) {
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
const handleMediaUrl = async (bot, msg) => {
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
            const { downloadUrl, title, isVideo } = await getDownloadDetails(url);
            const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
            if (isVideo) {
                await bot.sendMessage(chatId, 'Do you want the video or just the audio (MP3)?', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Video', callback_data: 'video' },
                                { text: 'Audio', callback_data: 'audio' }
                            ]
                        ],
                    }
                });
                bot.once('callback_query', async (callbackQuery) => {
                    const action = callbackQuery.data;
                    const userId = callbackQuery.from.id;
                    const replyMessageId = callbackQuery.message?.message_id;
                    if (replyMessageId) {
                        await bot.deleteMessage(userId, replyMessageId.toString());
                    }
                    try {
                        if (action === 'video') {
                            await processAndSendMedia(bot, chatId, downloadUrl, `${sanitizedTitle}.mp4`, 'upload_video', 'Video');
                        }
                        else if (action === 'audio') {
                            await processAndSendMedia(bot, chatId, downloadUrl, `${sanitizedTitle}.mp3`, 'upload_audio', 'Audio');
                        }
                    }
                    catch (error) {
                        await handleError(bot, chatId, `Failed to process media: ${error.message}`);
                    }
                    await bot.deleteMessage(chatId, processingMessage.message_id.toString());
                });
            }
        }
        catch (error) {
            await handleError(bot, chatId, error.message, processingMessage.message_id);
        }
    }
    else {
        bot.sendMessage(chatId, 'Invalid URL. Please enter a correct YouTube, Instagram, or TikTok URL.', {
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
exports.handleMediaUrl = handleMediaUrl;
const getDownloadDetails = async (url) => {
    console.log("URL:", url);
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
        return await getYouTubeDownloadDetails(url);
    }
    else if (url.includes("instagram.com")) {
        return await getInstagramDownloadDetails(url);
    }
    else if (url.includes("tiktok.com")) {
        return await getTikTokDownloadDetails(url);
    }
    else if (url.match(/\.(jpeg|jpg|gif|png)$/) != null) {
        throw new Error('Invalid URL. Please enter a YouTube, Instagram, or TikTok URL.');
    }
    else {
        throw new Error('Invalid URL. Please enter a correct URL.');
    }
};
const getYouTubeDownloadDetails = async (url) => {
    const videoId = extractVideoId(url);
    if (!videoId) {
        throw new Error('Invalid YouTube URL. Please enter a correct URL.');
    }
    const apiResponse = await fetchFromApi({ videoId: videoId }, 'https://youtube-media-downloader.p.rapidapi.com/v2/video/details', 'youtube-media-downloader.p.rapidapi.com');
    if (!apiResponse.data.status || apiResponse.data.errorId !== 'Success') {
        throw new Error('Invalid API response');
    }
    const downloadUrl = apiResponse.data.videos.items[0].url;
    const title = apiResponse.data.title;
    const isVideo = true;
    if (!downloadUrl || !title) {
        throw new Error('Invalid API response');
    }
    return { downloadUrl, title, isVideo };
};
const getInstagramDownloadDetails = async (url) => {
    const isStory = url.includes("/stories/");
    const apiResponse = await fetchFromApi({ url }, 'https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index', 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com');
    console.log("API response:", apiResponse);
    if (!apiResponse.status || apiResponse.statusText !== 'OK') {
        throw new Error('Invalid API response');
    }
    if (isStory) {
        if (!apiResponse.data.result || !apiResponse.data.result.video_url) {
            throw new Error('Invalid API response');
        }
        const downloadUrl = apiResponse.data.result.video_url;
        const title = apiResponse.data.result.username || 'instagram_story';
        const isVideo = true;
        return { downloadUrl, title, isVideo };
    }
    else {
        if (!apiResponse.data.media || !apiResponse.data.title) {
            throw new Error('Invalid API response');
        }
        const downloadUrl = apiResponse.data.media;
        const title = apiResponse.data.title || 'instagram_video';
        const isVideo = true;
        return { downloadUrl, title, isVideo };
    }
};
const getTikTokDownloadDetails = async (url) => {
    console.log(`Getting TikTok download details for URL: ${url}`);
    try {
        const apiResponse = await fetchFromApi({ url: url, hd: '0' }, 'https://tiktok-download-without-watermark.p.rapidapi.com/analysis', 'tiktok-download-without-watermark.p.rapidapi.com');
        console.log(`API Response: ${JSON.stringify(apiResponse.data)}`);
        if (!apiResponse.data || apiResponse.data.code !== 0 || !apiResponse.data.data || !apiResponse.data.data.play) {
            throw new Error('Invalid API response or no play URL found.');
        }
        const downloadUrl = apiResponse.data.data.play;
        const title = apiResponse.data.data.title || 'tiktok_video';
        const isVideo = true;
        return { downloadUrl, title, isVideo };
    }
    catch (error) {
        console.error('Error fetching TikTok download details:', error.message);
        throw new Error('Failed to fetch TikTok video details. Please ensure the URL is correct and try again.');
    }
};
const processAndSendMedia = async (bot, chatId, downloadUrl, outputFileName, action, mediaType) => {
    const output = path_1.default.resolve(__dirname, outputFileName);
    console.log('output:', output);
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            console.log('mediaType:', mediaType);
            console.log('downloadUrl:', downloadUrl);
            if (mediaType === 'Video') {
                await downloadVideo(downloadUrl, output);
            }
            else {
                await downloadAudio(downloadUrl, output);
            }
            break;
        }
        catch (error) {
            console.log('error:', error);
            if (attempt < MAX_RETRIES - 1) {
                console.warn(`Retrying download (${attempt + 1}/${MAX_RETRIES})...`);
            }
            else {
                console.error(`Failed to download ${mediaType.toLowerCase()}: ${error.message}`);
                throw error;
            }
        }
    }
    const fileSizeMB = getFileSizeInMB(output);
    if (fileSizeMB > FILE_SIZE_LIMIT_MB) {
        await bot.sendMessage(chatId, `The ${mediaType.toLowerCase()} size is larger than ${FILE_SIZE_LIMIT_MB} MB. Please upload another ${mediaType.toLowerCase()}.`, {
            reply_markup: {
                keyboard: [
                    [{ text: "Bot turini o'zgartirish" }]
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        });
    }
    else {
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
            else {
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
        }
        catch (error) {
            console.error(`Failed to send ${mediaType.toLowerCase()}: ${error.message}`);
            throw error;
        }
        finally {
            fs_1.default.unlinkSync(output); // Delete the file from the server
        }
    }
};
const handleError = async (bot, chatId, errorMessage, processingMessageId) => {
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
const extractVideoId = (url) => {
    console.log('URL:', url);
    try {
        const urlObj = new URL(url);
        console.log('urlObj:', urlObj);
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }
        else if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com' || urlObj.hostname === 'm.youtube.com') {
            const videoId = urlObj.searchParams.get('v');
            if (videoId)
                return videoId;
            const shortsId = urlObj.pathname.split('/shorts/')[1];
            if (shortsId)
                return shortsId;
        }
        else if (urlObj.pathname.includes('/embed/')) {
            return urlObj.pathname.split('/embed/')[1];
        }
        else if (urlObj.pathname.includes('/v/')) {
            return urlObj.pathname.split('/v/')[1];
        }
        else {
            const siParam = urlObj.searchParams.get('si');
            if (siParam)
                return siParam;
            const match = url.match(/(?:youtube\.com\/\S*(?:(?:\/e(?:mbed))?\/|v\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{6,11})/);
            return (match && match[1]) ? match[1] : null;
        }
    }
    catch (error) {
        console.error('Invalid URL:', error);
        return null;
    }
};
//# sourceMappingURL=downloader.js.map