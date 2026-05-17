import { Telegraf } from 'telegraf';
import OpenAI from 'openai';
import { settings } from './config/settings.js';
import './database/db.js';
import { registerOnboarding } from './bot/onboarding.js';
import { registerHandlers } from './bot/handlers.js';

// ─── Inicialización ───────────────────────────────────────────────────────────
console.log(`\n🤖 ${settings.tutor.name} — Bot Tutor de Idiomas`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// OpenAI
const openai = new OpenAI({ apiKey: settings.openai.apiKey });

// Telegraf
const bot = new Telegraf(settings.telegram.token);

// ─── Middleware: log de mensajes entrantes ────────────────────────────────────
bot.use(async (ctx, next) => {
  const from = ctx.from;
  if (from) {
    const type = ctx.updateType;
    const text = ctx.message?.text || ctx.callbackQuery?.data || '';
    console.log(`[${new Date().toISOString()}] [${type}] @${from.username || from.id}: ${text.slice(0, 60)}`);
  }
  return next();
});

// ─── Registrar handlers ───────────────────────────────────────────────────────
registerOnboarding(bot);
registerHandlers(bot, openai);

// ─── Configurar menú de comandos de Telegram ─────────────────────────────────
bot.telegram.setMyCommands([
  { command: 'start', description: '🚀 Iniciar / Reiniciar tutor' },
  { command: 'menu', description: '📋 Mostrar el menú principal interactivo' },
  { command: 'level', description: '🎯 Ver o cambiar tu nivel <1-100>' },
  { command: 'infot', description: '📊 Mostrar progreso y estadísticas' },
  { command: 'language', description: '🎯 Cambiar idioma a aprender' },
  { command: 'info', description: 'ℹ️ Información del bot y creador' },
  { command: 'clear', description: '🧹 Eliminar historial y reiniciar lección' }
]).then(() => {
  console.log('✅ Menú azul de comandos de Telegram configurado con éxito!');
}).catch(err => {
  console.error('❌ Error al configurar comandos de Telegram:', err.message);
});

// ─── Captura de Errores de Telegraf (Evita caídas por fallos en handlers) ━━━━━━
bot.catch((err, ctx) => {
  console.error(`💥 [TELEGRAF ERROR] Error en la actualización ${ctx.update?.update_id}:`, err);
  ctx.reply('⚠️ *Lo siento, he tenido un pequeño desliz técnico en mis circuitos.* Pero sigo de pie, ¡puedes continuar hablándome! 💪', { parse_mode: 'Markdown' }).catch(() => {});
});

// ─── Lanzar bot ───────────────────────────────────────────────────────────────
bot.launch()
  .then(() => {
    console.log(`✅ ${settings.tutor.name} está en línea. Esperando mensajes...`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  })
  .catch((err) => {
    console.error('❌ Error al lanzar el bot:', err.message);
    process.exit(1);
  });

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.once('SIGINT',  () => { console.log('\n👋 Cerrando...'); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { console.log('\n👋 Cerrando...'); bot.stop('SIGTERM'); });

// ─── Captura de Errores Globales del Proceso Node.js ──────────────────────────
process.on('uncaughtException', (err) => {
  console.error('💥 [CRÍTICO] Excepción no capturada en el proceso:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [CRÍTICO] Promesa no capturada en el proceso:', reason);
});
