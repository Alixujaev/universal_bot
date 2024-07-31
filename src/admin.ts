import { bot } from './botInstance';
import { User } from './utils/user';

export let isBroadcasting = false;
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '');

export const handleAdminCommand = async (msg) => {
    const chatId = msg.chat.id;
    if (chatId === ADMIN_ID) {
        isBroadcasting = !isBroadcasting;
        await bot.sendMessage(chatId, isBroadcasting ? 'Broadcasting mode ON' : 'Broadcasting mode OFF');
    }
};

export const broadcastMessage = async (msg) => {
    const chatId = msg.chat.id;
    const users = await User.find();
    if (isBroadcasting && chatId === ADMIN_ID) {
        users.forEach(async (user) => {
            if (user.chatId !== ADMIN_ID) {
                if (msg.text) {
                    await bot.sendMessage(user.chatId, msg.text);
                } else if (msg.photo) {
                    const photo = msg.photo[msg.photo.length - 1].file_id;
                    await bot.sendPhoto(user.chatId, photo, { caption: msg.caption });
                } else if (msg.video) {
                    const video = msg.video.file_id;
                    await bot.sendVideo(user.chatId, video, { caption: msg.caption });
                } else if (msg.audio) {
                    const audio = msg.audio.file_id;
                    await bot.sendAudio(user.chatId, audio, { caption: msg.caption });
                } else if (msg.document) {
                    const document = msg.document.file_id;
                    await bot.sendDocument(user.chatId, document, { caption: msg.caption });
                }
            }
        });
    }
};
