"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateText = translateText;
const googletrans_1 = require("googletrans");
async function translateText(text, targetLanguage) {
    try {
        const result = await (0, googletrans_1.translate)(text, { to: targetLanguage });
        return result.text;
    }
    catch (error) {
        console.error('Error translating text:', error);
        throw new Error('Translation failed');
    }
}
//# sourceMappingURL=translator.js.map