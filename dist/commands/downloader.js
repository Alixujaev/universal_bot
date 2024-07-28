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
const child_process_1 = require("child_process");
const mainMenu_1 = require("../utils/mainMenu");
const systemLangs_1 = require("../utils/systemLangs");
const ffmpegPath = 'C:\\ffmpeg\\ffmpeg-7.0.1-essentials_build\\bin\\ffmpeg.exe';
dotenv.config();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const FILE_SIZE_LIMIT_MB = 2000; // Telegram file size limit
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
const downloadFile = async (url, output) => {
    const response = await (0, axios_1.default)({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: TIMEOUT
    });
    return new Promise((resolve, reject) => {
        const stream = response.data.pipe(fs_1.default.createWriteStream(output));
        stream.on('finish', () => resolve());
        stream.on('error', (error) => {
            console.error(`Error downloading file: ${error.message}`);
            reject(error);
        });
    });
};
const downloadVideoAndAudio = async (videoUrl, audioUrl, videoOutput, audioOutput) => {
    try {
        await Promise.all([
            downloadFile(videoUrl, videoOutput),
            downloadFile(audioUrl, audioOutput)
        ]);
    }
    catch (error) {
        console.error('Error downloading files', error);
        throw error;
    }
};
const mergeVideoAndAudio = (videoPath, audioPath, outputPath) => {
    return new Promise((resolve, reject) => {
        const ffmpegCommand = `${ffmpegPath} -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac "${outputPath}"`;
        (0, child_process_1.exec)(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`ffmpeg error: ${error.message}`);
                reject(error);
                return;
            }
            console.log(`ffmpeg output: ${stdout}`);
            console.error(`ffmpeg stderr: ${stderr}`);
            resolve();
        });
    });
};
const downloadAndProcessMedia = async (downloadUrl, outputFileName, audioOutputFileName, mediaType, size, audioUrl, instaVideo) => {
    const output = path_1.default.resolve(__dirname, 'tmp', outputFileName);
    const photoOutput = path_1.default.resolve(__dirname, 'tmp', `${outputFileName}.jpg`);
    const audioOutput = path_1.default.resolve(__dirname, 'tmp', audioOutputFileName);
    const mergedOutput = path_1.default.resolve(__dirname, 'tmp', `merged_${outputFileName}.mp4`);
    if (size / 1048576 > FILE_SIZE_LIMIT_MB) {
        throw new Error(`The ${mediaType.toLowerCase()} size is larger than ${FILE_SIZE_LIMIT_MB} MB.`);
    }
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            if (mediaType === 'Video') {
                if (instaVideo) {
                    await downloadFile(downloadUrl, output);
                }
                else {
                    await downloadVideoAndAudio(downloadUrl, audioUrl, output, audioOutput);
                    await mergeVideoAndAudio(output, audioOutput, mergedOutput);
                }
            }
            else if (mediaType === 'Image') {
                const imageUrl = typeof downloadUrl === 'string' ? downloadUrl : downloadUrl.url;
                await downloadFile(imageUrl, photoOutput);
            }
            else {
                await downloadFile(downloadUrl, output);
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
    return { outputPath: output, audioOutputPath: audioOutput, mergedOutputPath: mergedOutput, photoOutputPath: photoOutput };
};
const sendMedia = async (bot, chatId, mediaType, filePaths, instaVideo) => {
    await bot.sendChatAction(chatId, mediaType === 'Video' ? 'upload_video' : mediaType === 'Audio' ? 'upload_audio' : 'upload_photo');
    try {
        if (mediaType === 'Video') {
            if (instaVideo) {
                await bot.sendVideo(chatId, filePaths.outputPath, {
                    caption: `@tg_multitask_bot`,
                    reply_markup: {
                        keyboard: [
                            [{ text: (0, systemLangs_1.getUserLanguage)(chatId) === 'uz' ? 'Bot turini o\'zgartirish' : (0, systemLangs_1.getUserLanguage)(chatId) === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    }
                });
            }
            else {
                await bot.sendVideo(chatId, filePaths.mergedOutputPath, {
                    caption: `@tg_multitask_bot`,
                    reply_markup: {
                        keyboard: [
                            [{ text: (0, systemLangs_1.getUserLanguage)(chatId) === 'uz' ? 'Bot turini o\'zgartirish' : (0, systemLangs_1.getUserLanguage)(chatId) === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    }
                });
            }
        }
        else if (mediaType === 'Audio') {
            await bot.sendAudio(chatId, filePaths.outputPath, {
                caption: `@tg_multitask_bot`,
                reply_markup: {
                    keyboard: [
                        [{ text: (0, systemLangs_1.getUserLanguage)(chatId) === 'uz' ? 'Bot turini o\'zgartirish' : (0, systemLangs_1.getUserLanguage)(chatId) === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                }
            });
        }
        else if (mediaType === 'Image') {
            await bot.sendDocument(chatId, filePaths.photoOutputPath, {
                caption: `@tg_multitask_bot`,
                reply_markup: {
                    keyboard: [
                        [{ text: (0, systemLangs_1.getUserLanguage)(chatId) === 'uz' ? 'Bot turini o\'zgartirish' : (0, systemLangs_1.getUserLanguage)(chatId) === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
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
        if (instaVideo) {
            if (mediaType === 'Video') {
                if (fs_1.default.existsSync(filePaths.outputPath))
                    fs_1.default.unlinkSync(filePaths.outputPath); // Delete the file from the serve
            }
            else {
                if (fs_1.default.existsSync(filePaths.photoOutputPath))
                    fs_1.default.unlinkSync(filePaths.photoOutputPath); // Delete the file from the serve
            }
        }
        else {
            if (fs_1.default.existsSync(filePaths.outputPath))
                fs_1.default.unlinkSync(filePaths.outputPath); // Delete the file from the server
            if (mediaType === 'Video' && fs_1.default.existsSync(filePaths.audioOutputPath))
                fs_1.default.unlinkSync(filePaths.audioOutputPath); // Delete the audio file from the server
            if (mediaType === 'Video' && fs_1.default.existsSync(filePaths.mergedOutputPath))
                fs_1.default.unlinkSync(filePaths.mergedOutputPath); // Delete the merged file from the server
        }
    }
};
const fetchFromApi = async (params, apiUrl, host, retries = MAX_RETRIES) => {
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
const getYouTubeDownloadDetails = async (url) => {
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
        ...apiResponse.data.formats.map((format) => ({
            url: format?.url,
            qualityLabel: format.qualityLabel,
            quality: format.quality,
            mimeType: format.mimeType,
            size: format.contentLength
        })),
        ...apiResponse.data.adaptiveFormats.map((format) => ({
            url: format?.url,
            qualityLabel: format.qualityLabel,
            quality: format.quality,
            mimeType: format.mimeType,
            size: format.contentLength
        }))
    ];
    // Filter out duplicate quality formats
    const uniqueFormats = allFormats.reduce((acc, current) => {
        const x = acc.find(item => item.quality === current.quality);
        if (!x) {
            return acc.concat([current]);
        }
        else {
            return acc;
        }
    }, []);
    if (!allFormats.length) {
        throw new Error('No available formats found');
    }
    const isVideo = true;
    return {
        title,
        channel,
        isVideo,
        formats: [
            { ...allFormats.reverse()[0], qualityLabel: 'mp3' },
            ...uniqueFormats.reverse(),
            { url: apiResponse.data.thumbnail[apiResponse.data.thumbnail.length - 1], qualityLabel: 'image' }
        ]
    };
};
const sendPaginatedFormats = async (bot, chatId, formats, title, channel, page, msg) => {
    const itemsPerPage = 18;
    const offset = (page - 1) * itemsPerPage;
    const paginatedFormats = formats.slice(offset, offset + itemsPerPage);
    const formatButtons = paginatedFormats.map((format, index) => ({
        text: `${format.qualityLabel == 'mp3' ? '🔉' : format.qualityLabel == 'image' ? '🖼' : '📹'} ${format.qualityLabel == 'image' ? '' : format.qualityLabel ? format.qualityLabel : format.quality}`,
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
    await (0, mainMenu_1.sendMessage)(chatId, bot, `📹${title}\n👤${channel}\n\n${paginatedFormats.filter(format => format.qualityLabel !== 'image').map(format => `✅ ${format.qualityLabel ? format.qualityLabel : format.quality} ${(format.size / 1048576).toFixed(0)} MB`).join('\n')
        + '\n\n' + '↓ ↓ ↓'}`, {
        reply_markup: {
            inline_keyboard: inlineKeyboard
        },
        reply_to_message_id: msg.message_id
    });
};
const handleError = async (bot, chatId, errorMessage, processingMessageId) => {
    console.error('Error:', errorMessage);
    await (0, mainMenu_1.sendMessage)(chatId, bot, 'Error. Please try again.', {
        reply_markup: {
            keyboard: [
                [{ text: (0, systemLangs_1.getUserLanguage)(chatId) === 'uz' ? 'Bot turini o\'zgartirish' : (0, systemLangs_1.getUserLanguage)(chatId) === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }]
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
const getInstagramDownloadDetails = async (url) => {
    const options = {
        method: 'POST',
        url: 'https://auto-download-all-in-one.p.rapidapi.com/v1/social/autolink',
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'auto-download-all-in-one.p.rapidapi.com',
            'Content-Type': 'application/json'
        },
        data: {
            url: url
        }
    };
    const apiResponse = await axios_1.default.request(options);
    if (!apiResponse.data || !apiResponse.data.medias || apiResponse.data.medias.length === 0) {
        throw new Error('Invalid API response');
    }
    const downloadUrl = apiResponse.data.medias[0].url;
    const extension = apiResponse.data.medias[0].extension;
    const title = apiResponse.data.title;
    if (!downloadUrl) {
        throw new Error('No downloadable content found');
    }
    return { downloadUrl, title, extension };
};
const getTikTokDownloadDetails = async (url) => {
    const options = {
        method: 'GET',
        url: 'https://tiktok-video-no-watermark2.p.rapidapi.com/',
        params: { url: url },
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'tiktok-video-no-watermark2.p.rapidapi.com',
            'Content-Type': 'application/json'
        },
    };
    const apiResponse = await axios_1.default.request(options);
    if (!apiResponse.data || apiResponse.statusText !== 'OK') {
        throw new Error('Invalid API response');
    }
    const downloadUrl = apiResponse.data.data.play;
    const extension = 'mp4';
    const title = apiResponse.data.data.title ? apiResponse.data.data.title : `${new Date().getTime()}`;
    if (!downloadUrl) {
        throw new Error('No downloadable content found');
    }
    return { downloadUrl, title, extension };
};
const handleDownloadCommand = async (bot, chatId) => {
    await (0, mainMenu_1.sendMessage)(chatId, bot, 'Please send the URL of the video you want to download.', {
        reply_markup: {
            keyboard: [
                [{ text: (0, systemLangs_1.getUserLanguage)(chatId) === 'uz' ? 'Bot turini o\'zgartirish' : (0, systemLangs_1.getUserLanguage)(chatId) === 'ru' ? 'Изменить режим работы бота' : 'Change bot type' }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    });
};
exports.handleDownloadCommand = handleDownloadCommand;
const handleMediaUrl = async (bot, msg) => {
    const chatId = msg.chat.id;
    const url = msg.text;
    if (url && url.startsWith("http")) {
        const processingMessage = await bot.sendMessage(chatId, (0, systemLangs_1.translateMessage)(chatId, 'Processing the URL, please wait..'), {
            reply_markup: {
                remove_keyboard: true
            }
        });
        addMessageToContext(chatId, processingMessage.message_id);
        try {
            if (url.includes('instagram.com')) {
                const { downloadUrl, title, extension } = await getInstagramDownloadDetails(url);
                const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
                const filePaths = await downloadAndProcessMedia(downloadUrl, `${sanitizedTitle}.${extension}`, '', extension === 'mp4' ? 'Video' : 'Image', FILE_SIZE_LIMIT_MB * 1048576, '', true);
                await sendMedia(bot, chatId, extension === 'mp4' ? 'Video' : 'Image', filePaths, true);
                await bot.deleteMessage(chatId, processingMessage.message_id.toString());
            }
            else if (url.includes('tiktok.com')) {
                const { downloadUrl, title, extension } = await getTikTokDownloadDetails(url);
                const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
                const filePaths = await downloadAndProcessMedia(downloadUrl, `${sanitizedTitle}.${extension}`, '', extension === 'mp4' ? 'Video' : 'Image', FILE_SIZE_LIMIT_MB * 1048576, '', true);
                await sendMedia(bot, chatId, extension === 'mp4' ? 'Video' : 'Image', filePaths, true);
                await bot.deleteMessage(chatId, processingMessage.message_id.toString());
            }
            else {
                const { title, isVideo, channel, formats } = await getYouTubeDownloadDetails(url);
                const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
                if (isVideo) {
                    await sendPaginatedFormats(bot, chatId, formats, title, channel, 1, msg);
                    bot.on('callback_query', async (callbackQuery) => {
                        const data = callbackQuery.data;
                        const userId = callbackQuery.from.id;
                        const replyMessageId = callbackQuery.message?.message_id;
                        const chatId = callbackQuery.message?.chat.id;
                        if (data.startsWith('page_')) {
                            const page = parseInt(data.split('_')[1], 10);
                            await sendPaginatedFormats(bot, chatId, formats, title, channel, page, msg);
                        }
                        else if (data.startsWith('format_')) {
                            const formatIndex = parseInt(data.split('_')[1], 10);
                            const selectedFormat = formats[formatIndex];
                            const formatUrl = selectedFormat.url;
                            const formatSize = selectedFormat.size;
                            if (replyMessageId) {
                                await bot.deleteMessage(userId, replyMessageId.toString());
                            }
                            let mediaType = 'Video';
                            if (selectedFormat.qualityLabel === 'mp3') {
                                mediaType = 'Audio';
                            }
                            else if (selectedFormat.qualityLabel === 'image') {
                                mediaType = 'Image';
                            }
                            try {
                                const filePaths = await downloadAndProcessMedia(formatUrl, `${sanitizedTitle}.${mediaType === 'Audio' ? 'mp3' : 'mp4'}`, `${sanitizedTitle}.mp3`, mediaType, formatSize, formats[0].url);
                                await sendMedia(bot, chatId, mediaType, filePaths);
                            }
                            catch (error) {
                                await handleError(bot, chatId, `Failed to process media: ${error.message}`);
                            }
                            await bot.deleteMessage(chatId, processingMessage.message_id.toString());
                        }
                    });
                }
            }
        }
        catch (error) {
            await handleError(bot, chatId, error.message, processingMessage.message_id);
        }
    }
    else {
        bot.sendMessage(chatId, 'Invalid URL. Please enter a correct URL.', {
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
//# sourceMappingURL=downloader.js.map