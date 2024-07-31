import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

export const connectDatabase = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB ga muvaffaqiyatli ulandi');
    } catch (error) {
        console.error('MongoDB ga ulanishda xatolik:', error);
    }
};
