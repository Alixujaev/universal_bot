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

    const sendMessagesInBatches = async (users, batchSize = 20, delay = 1000) => {
        for (let i = 0; i < users.length; i += batchSize) {
            const batch = users.slice(i, i + batchSize);
            await Promise.all(batch.map(async (user) => {
                if (user.chatId !== ADMIN_ID) {
                    try {
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
                    } catch (error) {
                        if (error.response && error.response.statusCode === 403) {
                            // Foydalanuvchi botni blok qilgan, o'chirib tashlash
                            await User.findOneAndDelete({ chatId: user.chatId });
                            console.error(`User ${user.chatId} blocked the bot and has been removed from the database.`);
                        } else {
                            console.error(`Failed to send message to ${user.chatId}:`, error);
                        }
                    }
                }
            }));
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    };

    if (isBroadcasting && chatId === ADMIN_ID) {
        await sendMessagesInBatches(users);
        await bot.sendMessage(ADMIN_ID, 'Barchaga xabar jo\'natildi');
    }
};


export const handleStatsCommand = async (msg) => {
    const chatId = msg.chat.id;
    if (chatId === ADMIN_ID) {
        const userCount = await User.countDocuments();

        const statsMessage = `
        Bot foydalanuvchilari statistikasi:
- Jami foydalanuvchilar: ${userCount}
        `;

        await bot.sendMessage(ADMIN_ID, statsMessage);
    }
};