import { Telegraf } from 'telegraf';
import OpenAI from 'openai';
import { settings } from '../config/settings.js';
import '../database/db.js'; // Dispara la inicialización de base de datos dinámica (MongoDB Atlas o SQLite)
import { registerOnboarding } from '../bot/onboarding.js';
import { registerHandlers } from '../bot/handlers.js';

const bot = new Telegraf(settings.telegram.token);
const openai = new OpenAI({ apiKey: settings.openai.apiKey });

// Registrar los flujos principales del bot
registerOnboarding(bot);
registerHandlers(bot, openai);

/**
 * Serverless Function para procesar Webhooks de Telegram en Vercel
 */
export default async function handler(req, res) {
  // Respuesta informativa si entran con GET desde el navegador
  if (req.method !== 'POST') {
    return res.status(200).send('🤖 ¡El Tutor de Idiomas Noah está en línea y listo para recibir webhooks de Telegram!');
  }

  try {
    // Telegraf maneja la actualización directamente
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Error procesando actualización en Vercel Webhook:', err.message);
    // Retornamos 200 de todas formas para que Telegram no reintente el mensaje fallido infinitamente
    res.status(200).send(`Error: ${err.message}`);
  }
}
