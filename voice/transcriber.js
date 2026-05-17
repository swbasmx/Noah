import fetch from 'node-fetch';
import OpenAI, { toFile } from 'openai';
import { settings } from '../config/settings.js';
import { getUser } from '../database/db.js';

let groqClient = null;

function getGroqClient() {
  if (!groqClient) {
    groqClient = new OpenAI({
      apiKey: settings.groq.apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return groqClient;
}

/**
 * Descarga el archivo de voz de Telegram como stream y lo transcribe en memoria usando Groq Whisper (sin escribir en disco ni usar ffmpeg!).
 * @param {import('telegraf').Context} ctx — Contexto de Telegraf
 * @param {string} fileId — ID del archivo de voz
 * @returns {Promise<string>} Texto transcrito
 */
export async function transcribeVoice(ctx, fileId) {
  try {
    // 1. Obtener el usuario para ajustar el idioma de transcripción
    const user = await getUser(ctx.from.id);
    const targetLang = user?.idioma_objetivo === 'ruso' ? 'ru' : 'en';

    // 2. Obtener la URL del archivo de voz desde Telegram
    const fileInfo = await ctx.telegram.getFile(fileId);
    const downloadUrl = `https://api.telegram.org/file/bot${settings.telegram.token}/${fileInfo.file_path}`;

    // 3. Obtener el stream del audio en formato OGG directamente
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Error descargando audio: ${res.statusText}`);

    // 4. Crear el archivo en memoria para enviar por Form-Data usando toFile
    // Groq Whisper acepta OGG nativamente, así que no es necesario ffmpeg!
    const file = await toFile(res.body, 'audio.ogg', { type: 'audio/ogg' });

    // 5. Enviar a Groq Whisper por stream
    const groq = getGroqClient();
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: process.env.WHISPER_MODEL || 'whisper-large-v3',
      language: targetLang,
    });

    return transcription.text;

  } catch (err) {
    console.error('❌ [Transcriber Stream] Error en la transcripción de voz por stream:', err.message);
    throw err;
  }
}
