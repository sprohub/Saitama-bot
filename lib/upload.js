import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// __dirname setup para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function quAx(filePath) {
  try {
    const file = fs.createReadStream(filePath);
    const formData = new FormData();
    formData.append('files[]', file, path.basename(filePath));

    const response = await axios.post('https://qu.ax/upload.php', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    // DEBUG: para ver qué responde la API
    console.log('qu.ax upload response:', response.data);

    // Verifica si response.data.files existe y tiene al menos 1 archivo
    if (response.data?.files && response.data.files.length > 0) {
      const fileData = response.data.files[0];
      return {
        status: true,
        creator: 'EliasarYT',
        result: {
          hash: fileData.hash || '',
          name: fileData.name || '',
          url: fileData.url || '',
          size: fileData.size || '',
          expiry: fileData.expiry || ''
        }
      };
    } else {
      return { status: false, message: 'Error al subir el archivo - formato inesperado' };
    }
  } catch (error) {
    console.error('qu.ax upload error:', error);
    return { status: false, message: error.message };
  }
}