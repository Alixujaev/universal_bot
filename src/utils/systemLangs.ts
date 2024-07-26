import TelegramBot from 'node-telegram-bot-api';
import { addMessageToContext } from './mainMenu';

export const userLanguageMap = new Map<number, { code: string, name: string, flag: string, translationFunction: (text: string) => string }>();

export function translateToUzbek (text: string) {
  const translations = {
      'Welcome to the universal bot! Please choose from the menu below:': 'Universal botga xush kelibsiz! Quyidagi menyudan tanlang:',
      'Please choose from the menu below:': 'Quyidagi menyudan tanlang:',
      'You have selected the translation bot. Here you can translate texts.': 'Siz tarjima botini tanladingiz. Bu yerda siz textlarni tarjima qilishingiz mumkin.',
      'You have selected the downloader service.': 'Siz yuklovchi bot xizmatini tanladingiz',
      'You have selected the currency calculator.': 'Siz valyuta kalkulyatorini tanladingiz',
      'You have selected the file conversion service.': 'Siz fayl konvertatsiya qilish xizmatini tanladingiz',
      'Please select your language:': 'Iltimos, tilni tanlang:',
      'Translation': 'Tarjima',
      'Download': 'Yuklash',
      'Currency Calculator': 'Valyuta Kalkulyatori',
      'File Conversion': 'Fayl Konvertatsiyasi',
      'Change bot type': 'Bot turini o\'zgartirish',
      'Invalid command. This command only works in "Currency Calculator" mode.': 'Noto‘g‘ri amal. Ushbu buyruq faqat "Valyuta Kalkulyatori" rejimida ishlaydi.',
      'Invalid command. This command only works in "Translation" mode.': 'Noto‘g‘ri amal. Ushbu buyruq faqat "Tarjima" rejimida ishlaydi.',
      'Invalid command. Please select a valid option.': 'Noto‘g‘ri amal. Iltimos, to‘g‘ri variantni tanlang.',
      'What language would you like to translate into?': 'Qaysi tilga tarjima qilmoqchisiz?',
      'Please send the URL of the video you want to download.': 'Foydalanish uchun videoni URL manzilini yuboring.',
      'Error. Please try again.': 'Xato. Iltimos, qayta urunib ko‘ring.',
      'Processing the URL, please wait..': 'URL yuklanmoqda, kuting...',
      // Add more translations here
  };
  return translations[text] || text;
};

export function translateToRussian (text: string){
  const translations = {
      'Welcome to the universal bot! Please choose from the menu below:': 'Добро пожаловать в универсальный бот! Пожалуйста, выберите из меню ниже:',
      'Please choose from the menu below:': 'Пожалуйста, выберите из меню ниже:',
      'You have selected the translation bot. Here you can translate texts.': 'Вы выбрали бота перевода. Здесь вы можете переводить тексты.',
      'You have selected the downloader service.': 'Вы выбрали службу загрузки.',
      'You have selected the currency calculator.': 'Вы выбрали калькулятор валют.',
      'You have selected the file conversion service.': 'Вы выбрали службу конвертации файлов.',
      'Please select your language:': 'Пожалуйста, выберите ваш язык:',
      'Translation': 'Перевод',
      'Download': 'Скачать',
      'Currency Calculator': 'Калькулятор валют',
      'File Conversion': 'Конвертация файлов',
      'Change bot type': 'Изменить тип бота',
      'Invalid command. This command only works in "Currency Calculator" mode.': 'Неверная команда. Эта команда работает только в режиме "Калькулятор валют".',
      'Invalid command. This command only works in "Translation" mode.': 'Неверная команда. Эта команда работает только в режиме "Перевод".',
      'Invalid command. Please select a valid option.': 'Неверная команда. Пожалуйста, выберите допустимый вариант.',
      'What language would you like to translate into?': 'Какой язык вы хотите перевести в?',
      'Please send the URL of the video you want to download.': 'Пожалуйста, отправьте URL видео, которое вы хотите загрузить.',
      'Error. Please try again.': 'Ошибка. Пожалуйста, попробуйте ещё раз.',
      'Processing the URL, please wait..': 'Обработка URL, пожалуйста, подождите..',
      // Add more translations here
  };
  return translations[text] || text;
};


export const languageOptions = [
  { code: 'en', name: 'English', flag: '🇺🇸', translationFunction: text => text },
  { code: 'uz', name: 'Uzbek', flag: '🇺🇿', translationFunction: translateToUzbek },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', translationFunction: translateToRussian }
];


export const selectLanguage = async (chatId: number, bot: TelegramBot) => {
  const options = languageOptions.map(lang => ({ text: `${lang.flag} ${lang.name}`, callback_data: `start_lang_${lang.code}` }));
  const languageKeyboard = {
      reply_markup: {
          inline_keyboard: [options]
      }
  };
  const message = await bot.sendMessage(chatId, 'Please select your language:', languageKeyboard);
  addMessageToContext(chatId, message.message_id);
};


export const translateMessage = (chatId: number, text: string) => {
  const userLanguage = userLanguageMap.get(chatId);
  if (userLanguage) {
      return userLanguage.translationFunction(text);
  }
  return text;
};


export const getUserLanguage = (chatId: number) => {
  return userLanguageMap.get(chatId)?.code || 'en';
};