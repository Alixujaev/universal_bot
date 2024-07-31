import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const LOCAL_BOT_API_URL = process.env.LOCAL_BOT_API_URL;

if (!TELEGRAM_TOKEN) {
    throw new Error('TELEGRAM_TOKEN is not defined in environment variables');
}

export const bot = new TelegramBot(TELEGRAM_TOKEN, {
    polling: true,
    baseApiUrl: LOCAL_BOT_API_URL
});
