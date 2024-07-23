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
exports.handleTextToVoice = exports.handleVoiceToText = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const openai_1 = __importDefault(require("openai"));
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
const handleVoiceToText = async (bot, msg) => {
    const chatId = msg.chat.id;
    const fileId = msg.voice?.file_id;
    if (!fileId) {
        await bot.sendMessage(chatId, 'Audio faylni yuboring.');
        return;
    }
    const fileLink = await bot.getFileLink(fileId);
    const fileResponse = await axios_1.default.get(fileLink, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(fileResponse.data, 'binary');
    fs_1.default.writeFileSync('audio.ogg', buffer);
    const audio = fs_1.default.createReadStream('audio.ogg');
    const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: audio,
    });
    const transcription = response.text.split('\n').map(result => result.trim()).join('\n');
    await bot.sendMessage(chatId, `Transkriptiya:\n${transcription}`);
};
exports.handleVoiceToText = handleVoiceToText;
const handleTextToVoice = async (bot, msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) {
        await bot.sendMessage(chatId, 'Matnni kiriting.');
        return;
    }
    const speechFile = path_1.default.resolve('./speech.mp3');
    const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs_1.default.promises.writeFile(speechFile, buffer);
    await bot.sendVoice(chatId, speechFile);
};
exports.handleTextToVoice = handleTextToVoice;
//# sourceMappingURL=voice.js.map