export const mainMenuOptions = {
  reply_markup: {
      inline_keyboard: [
          [
              { text: 'Tarjima', callback_data: 'translate' },
              { text: 'Yuklash', callback_data: 'download' }
          ]
      ]
  }
};
