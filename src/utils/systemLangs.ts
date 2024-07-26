import TelegramBot from 'node-telegram-bot-api';
import { addMessageToContext } from './mainMenu';

export const userLanguageMap = new Map<number, { code: string, name: string, flag: string, translationFunction: (text: string, variables: { [key: string]: string }) => string }>();

export function translateToUzbek (text: string, variables: { [key: string]: string } = {}) {
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
      'Translation language is set to {flag} {name}. Now you can change the language by typing:\n\n/setlanguage': `Tarjima tili {flag} {name} qilib o'rnatildi. Endi matnni kiriting:\n\n/setlanguage orqali tilni o'zgartirishingiz mumkin`,
      'Which currency do you want to calculate?': 'Qaysi valyutani kalkulyatsiya qilishni xohlaysiz?',
      'Please enter the correct amount:': 'Iltimos, to‘g‘ri miqdorni kiriting:',
      'An error occurred while retrieving exchange rates. Please try again later.': 'Valyuta kalkulyatsiyasi olishida xatolik yuz berdi. Iltimos, qayta urunib ko‘ring.',
      'Please select currencies first.': 'Iltimos, valyutalarni tanlang.',
      'You have selected the currency {curr} {flag}. Which currency do you want to calculate now?': 'Siz {curr} {flag} valyutasini tanladingiz. Endi qaysi valyutaga kalkulyatsiya qilishni xohlaysiz?',
      'You have chosen to calculate from {curr_1} {flag_1} currency to {curr_2} {flag_2} currency. Please enter an amount:\n\n/change_currency - change currency': `Siz {curr_1} {flag_1} valyutasidan {curr_2} {flag_2} valyutasiga kalkulyatsiya qilishni tanladingiz. Iltimos, miqdorni kiriting:\n\n/change_currency - valyutani o'zgartirish`
      // Add more translations here
  };

  let translatedText = translations[text] || text;

    for (const key in variables) {
        translatedText = translatedText.replace(`{${key}}`, variables[key]);
    }

    return translatedText;
};

export function translateToRussian (text: string, variables: { [key: string]: string } = {}){
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
      'Translation language is set to {flag} {name}. Now you can change the language by typing:\n\n/setlanguage': 'Язык перевода установлен на {flag} {name}. Теперь вы можете изменить язык перевода, нажав:\n\n/setlanguage',
      'Which currency do you want to calculate?': 'Какую валюту вы хотите калькулировать?',
      'Please enter the correct amount:': 'Пожалуйста, введите правильную сумму:',
      'An error occurred while retrieving exchange rates. Please try again later.': 'Произошла ошибка при получении курсов. Пожалуйста, попробуйте ещё раз позже.',
      'Please select currencies first.': 'Пожалуйста, выберите валюты.',
      'You have selected the currency {curr} {flag}. Which currency do you want to calculate now?': 'Вы выбрали валюту {curr} {flag}. В какой валюте вы хотите рассчитать сейчас?',
      'You have chosen to calculate from {curr_1} {flag_1} currency to {curr_2} {flag_2} currency. Please enter an amount:\n\n/change_currency - change currency': 'Вы выбрали расчет из валюты {curr_1} {flag_1} в валюту {curr_2} {flag_2}. Введите сумму:\n\n/change_currency - изменить валюту'
      // Add more translations here
  };
  let translatedText = translations[text] || text;

    for (const key in variables) {
        translatedText = translatedText.replace(`{${key}}`, variables[key]);
    }

    return translatedText;
};

export function translateToEnglish (text: string, variables: { [key: string]: string } = {}){
  const translations = {
    'Welcome to the universal bot! Please choose from the menu below:': 'Welcome to the universal bot! Please choose from the menu below:',
    'You have selected the translation bot. Here you can translate texts.': 'You have selected the translation bot. Here you can translate texts.',
    'You have selected the downloader service.': 'You have selected the downloader service.',
    'You have selected the currency calculator.': 'You have selected the currency calculator.',
    'You have selected the file conversion service.': 'You have selected the file conversion service.',
    'Please select your language:': 'Please select your language:',
    'Translation': 'Translation',
    'Download': 'Download',
    'Currency Calculator': 'Currency Calculator',
    'File Conversion': 'File Conversion',
    'Change bot type': 'Change bot type',
    'Invalid command. This command only works in "Currency Calculator" mode.': 'Invalid command. This command only works in "Currency Calculator" mode.',
    'Invalid command. This command only works in "Translation" mode.': 'Invalid command. This command only works in "Translation" mode.',
    'What language would you like to translate into?': 'What language would you like to translate into?',
    'Hello, {name}! Welcome back.': 'Hello, {name}! Welcome back.',
    'Translation language is set to {flag} {name}. Now you can change the language by typing:\n\n/setlanguage': 'Translation language is set to {flag} {name}. Now you can change the language by typing:\n\n/setlanguage',
    'Which currency do you want to calculate?': 'Which currency do you want to calculate?',
    'Please enter the correct amount:': 'Please enter the correct amount:',
    'An error occurred while retrieving exchange rates. Please try again later.': 'An error occurred while retrieving exchange rates. Please try again later.',
    'Please select currencies first.': 'Please select currencies first.',
    'You have selected the currency {curr} {flag}. Which currency do you want to calculate now?': 'You have selected the currency {curr} {flag}. Which currency do you want to calculate now?',
    'You have chosen to calculate from {curr_1} {flag_1} currency to {curr_2} {flag_2} currency. Please enter an amount:\n\n/change_currency - change currency': 'You have chosen to calculate from {curr_1} {flag_1} currency to {curr_2} {flag_2} currency. Please enter an amount:\n\n/change_currency - change currency',
      // Add more translations here
  };
  let translatedText = translations[text] || text;

    for (const key in variables) {
        translatedText = translatedText.replace(`{${key}}`, variables[key]);
    }

    return translatedText;
};


export const languageOptions = [
  { code: 'en', name: 'English', flag: '🇺🇸', translationFunction: translateToEnglish},
  { code: 'uz', name: 'Uzbek', flag: '🇺🇿', translationFunction: translateToUzbek },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', translationFunction: translateToRussian },
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


export const translateMessage = (chatId: number, text: string, variables: { [key: string]: string } = {}) => {
  const userLanguage = userLanguageMap.get(chatId);
  if (userLanguage) {
      return userLanguage.translationFunction(text, variables);
  }
  return text;
};


export const getUserLanguage = (chatId: number) => {
  return userLanguageMap.get(chatId)?.code || 'en';
};