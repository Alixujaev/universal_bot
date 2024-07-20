import { translate } from 'googletrans';

export async function translateText(text: string, targetLanguage: string): Promise<string> {
    try {
        const result = await translate(text, { to: targetLanguage });
        return result.text;
    } catch (error) {
        console.error('Error translating text:', error);
        throw new Error('Translation failed');
    }
}
