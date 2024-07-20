import axios from 'axios';
import fs from 'fs';

export async function isGeneratedByAI(file) {
  try {
    const fileContent = fs.readFileSync(file, 'utf8');
    const formData = new FormData();
    formData.append('image', fileContent);

    const response = await axios.post('https://api.deepai.org/api/image-similarity', formData, {
      headers: {
        'Api-Key': process.env.DEEPAI_API_KEY,
      }
    });

    // DeepAI API dan olingan natijalarni qayta ishlash
    const output = response.data.output;
    if (output && output.length > 0) {
      const similarity = output[0].similarity;
      return similarity * 100; // Foizda qiymat
    } else {
      return false;
    }
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function downloadFile(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return response.data;
}