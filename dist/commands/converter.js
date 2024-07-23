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
exports.handleVideoMessage = exports.handleDocumentMessage = exports.handleFileConversion = exports.handleConvertCommand = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const form_data_1 = __importDefault(require("form-data"));
dotenv.config();
const ZAMZAR_API_KEY = process.env.ZAMZAR_API_KEY;
const ZAMZAR_API_URL = 'https://sandbox.zamzar.com/v1';
if (!ZAMZAR_API_KEY) {
    throw new Error('ZAMZAR_API_KEY is not defined in environment variables');
}
const userMessageMap = new Map();
const userFileMap = new Map();
const addMessageToContext = (chatId, messageId) => {
    const messages = userMessageMap.get(chatId) || [];
    messages.push(messageId);
    userMessageMap.set(chatId, messages);
};
const handleConvertCommand = async (bot, chatId) => {
    const sentMessage = await bot.sendMessage(chatId, 'Please send the file you want to convert.', {
        reply_markup: {
            keyboard: [
                [{ text: "Bot turini o'zgartirish" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        },
    });
    addMessageToContext(chatId, sentMessage.message_id);
};
exports.handleConvertCommand = handleConvertCommand;
const getConversionFormats = async (fileType) => {
    const response = await axios_1.default.get(`${ZAMZAR_API_URL}/formats/${fileType}`, {
        auth: {
            username: ZAMZAR_API_KEY,
            password: ''
        }
    });
    return response.data.targets ? response.data.targets : [];
};
const uploadFileToZamzar = async (filePath, targetFormat) => {
    const formData = new form_data_1.default();
    formData.append('source_file', fs_1.default.createReadStream(filePath));
    formData.append('target_format', targetFormat);
    const response = await axios_1.default.post(`${ZAMZAR_API_URL}/jobs`, formData, {
        auth: {
            username: ZAMZAR_API_KEY,
            password: ''
        },
        headers: {
            ...formData.getHeaders()
        }
    });
    return response.data;
};
const downloadConvertedFile = async (fileUrl, outputPath) => {
    const response = await axios_1.default.get(fileUrl, {
        responseType: 'stream',
        auth: {
            username: ZAMZAR_API_KEY,
            password: ''
        }
    });
    return new Promise((resolve, reject) => {
        const stream = response.data.pipe(fs_1.default.createWriteStream(outputPath));
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
    });
};
const handleFileConversion = async (bot, callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    const targetFormat = data.split('_')[1];
    if (!chatId || !targetFormat)
        return;
    const fileInfo = userFileMap.get(chatId);
    if (!fileInfo)
        return;
    const { fileId, fileName, fileType } = fileInfo;
    const fileLink = await bot.getFileLink(fileId);
    const filePath = path_1.default.join(__dirname, 'tmp', fileName);
    const processingMessage = await bot.sendMessage(chatId, 'Processing the file, please wait...', {
        reply_markup: {
            remove_keyboard: true
        },
        reply_to_message_id: callbackQuery.message?.message_id
    });
    addMessageToContext(chatId, processingMessage.message_id);
    // Ensure the tmp directory exists
    if (!fs_1.default.existsSync(path_1.default.dirname(filePath))) {
        fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
    }
    try {
        // Download the file from Telegram
        const response = await (0, axios_1.default)({
            method: 'GET',
            url: fileLink,
            responseType: 'stream'
        });
        const fileStream = fs_1.default.createWriteStream(filePath);
        response.data.pipe(fileStream);
        await new Promise((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
        const uploadResponse = await uploadFileToZamzar(filePath, targetFormat);
        const jobId = uploadResponse.id;
        let jobResponse;
        // Polling the job status
        let jobStatus = uploadResponse.status;
        while (jobStatus !== 'successful') {
            jobResponse = await axios_1.default.get(`${ZAMZAR_API_URL}/jobs/${jobId}`, {
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
        const outputPath = path_1.default.join(__dirname, 'tmp', `${path_1.default.basename(fileName, path_1.default.extname(fileName))}.${targetFormat}`);
        await downloadConvertedFile(fileDownloadUrl, outputPath);
        await bot.sendChatAction(chatId, 'upload_document');
        await bot.sendDocument(chatId, outputPath, {
            reply_markup: {
                keyboard: [
                    [{ text: "Bot turini o'zgartirish" }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            caption: '🤖 @tg_multitask_bot',
            reply_to_message_id: callbackQuery.message?.message_id
        });
        // Delete the file from the server
        fs_1.default.unlink(outputPath, (err) => {
            if (err)
                console.error(`Failed to delete file: ${outputPath}`, err);
            else
                console.log(`Deleted file: ${outputPath}`);
        });
    }
    catch (error) {
        console.log('Error:', error);
        if (error.response.status === 413) {
            await bot.sendMessage(chatId, 'The file is too large to convert. Please send a smaller file.', {
                reply_markup: {
                    keyboard: [
                        [{ text: "Bot turini o'zgartirish" }],
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                },
                reply_to_message_id: callbackQuery.message?.message_id
            });
        }
        else {
            await bot.sendMessage(chatId, `Failed to convert file: ${error.message}`, {
                reply_markup: {
                    keyboard: [
                        [{ text: "Bot turini o'zgartirish" }],
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                },
                reply_to_message_id: callbackQuery.message?.message_id
            });
        }
    }
    finally {
        // Delete the original file from the server
        fs_1.default.unlink(filePath, (err) => {
            if (err)
                console.error(`Failed to delete file: ${filePath}`, err);
            else
                console.log(`Deleted file: ${filePath}`);
        });
        await bot.deleteMessage(chatId, processingMessage.message_id.toString());
    }
};
exports.handleFileConversion = handleFileConversion;
const handleDocumentMessage = async (bot, msg) => {
    const chatId = msg.chat.id;
    const fileId = msg.document?.file_id;
    const fileName = msg.document?.file_name;
    const mimeType = msg.document?.mime_type;
    if (!fileId || !fileName || !mimeType) {
        await bot.sendMessage(chatId, 'Please send a valid file.', { reply_markup: {
                keyboard: [
                    [{ text: "Bot turini o'zgartirish" }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            reply_to_message_id: msg.message_id });
        return;
    }
    await bot.sendChatAction(chatId, 'typing');
    const fileType = fileName.split('.').pop();
    const availableFormats = await getConversionFormats(fileType);
    if (availableFormats.length === 0) {
        await bot.sendMessage(chatId, 'No available conversion formats for this file type.', {
            reply_markup: {
                keyboard: [
                    [{ text: "Bot turini o'zgartirish" }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            reply_to_message_id: msg.message_id
        });
        return;
    }
    userFileMap.set(chatId, { fileId, fileName, fileType });
    const formatButtons = availableFormats.map((format) => ({ text: format.name.toUpperCase(), callback_data: `convert_${format.name}` }));
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
exports.handleDocumentMessage = handleDocumentMessage;
// Yangi funksiya videolarni qayta ishlash uchun
const handleVideoMessage = async (bot, msg) => {
    const chatId = msg.chat.id;
    const fileId = msg.video?.file_id || msg.video_note?.file_id;
    const fileName = `${msg.video?.file_unique_id || msg.video_note?.file_unique_id}.mp4`;
    const mimeType = msg.video?.mime_type || 'video/mp4';
    if (!fileId || !fileName || !mimeType) {
        await bot.sendMessage(chatId, 'Please send a valid video.', {
            reply_markup: {
                keyboard: [
                    [{ text: "Bot turini o'zgartirish" }],
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
                    [{ text: "Bot turini o'zgartirish" }],
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            },
            reply_to_message_id: msg.message_id
        });
        return;
    }
    userFileMap.set(chatId, { fileId, fileName, fileType });
    const formatButtons = availableFormats.map((format) => ({ text: format.name.toUpperCase(), callback_data: `convert_${format.name}` }));
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
exports.handleVideoMessage = handleVideoMessage;
//# sourceMappingURL=converter.js.map