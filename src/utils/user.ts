import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  language: { 
    code: { type: String, required: false },
    name: { type: String, required: false },
    flag: { type: String, required: false },
  },
  is_premium: { type: Boolean, required: false },
});

export const User = mongoose.model('User', userSchema);