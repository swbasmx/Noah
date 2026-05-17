import {
  createUser,
  updateUser,
  setUserState,
  initProgress,
  openSession,
  getUser,
} from '../database/db.js';
import { triggerFirstTutorMessage, sendLevelCardImage } from './level_detector.js';
import {
  confirmNativeLangKeyboard,
  nativeLangKeyboard,
  targetLangKeyboard,
  initialLevelKeyboard,
} from './menus.js';
import { settings } from '../config/settings.js';

// Mapa de códigos ISO → nombre legible
const LANG_NAMES = {
  es: 'Español',
  pt: 'Portugués',
  fr: 'Francés',
  de: 'Alemán',
  en: 'Inglés',
  it: 'Italiano',
  zh: 'Chino',
  ja: 'Japonés',
  ru: 'Ruso',
  ar: 'Árabe',
};

// Mapa code → nombre de idioma objetivo (para guardar en DB)
const TARGET_LANGS = {
  target_en: 'inglés',
  target_ru: 'ruso',
  target_fr: 'francés',
  target_ja: 'japonés',
  target_ko: 'coreano',
  target_pt: 'portugués',
  target_de: 'alemán',
  target_it: 'italiano',
};

// Mapa code → idioma nativo
const NATIVE_LANGS = {
  native_es:    'español',
  native_pt:    'portugués',
  native_fr:    'francés',
  native_de:    'alemán',
  native_other: 'otro',
};

/**
 * Registra todos los handlers del flujo de onboarding en el bot de Telegraf.
 * @param {import('telegraf').Telegraf} bot
 */
export function registerOnboarding(bot) {

  // ── /start ────────────────────────────────────────────────────────────────
  bot.start(async (ctx) => {
    const from      = ctx.from;
    const nombre    = from.first_name || 'amigo';
    const langCode  = from.language_code || 'es';
    const langName  = LANG_NAMES[langCode] || langCode;

    // 1. Consultar si el usuario ya existe y está configurado
    const existingUser = await getUser(from.id);
    if (existingUser && !['onboarding', 'onboarding_native', 'onboarding_target', 'onboarding_level'].includes(existingUser.estado)) {
      // Bienvenida de regreso sin alterar su nivel ni progreso!
      return ctx.reply(
        `👋 ¡Hola de nuevo, *${existingUser.nombre}*! Qué alegría verte por aquí de nuevo.\n\n` +
        `🎯 *Tu Nivel Actual:* ${existingUser.nivel_actual}\n` +
        `🗣️ *Idioma de aprendizaje:* ${existingUser.idioma_objetivo}\n\n` +
        `🚀 Puedes continuar tu lección escribiendo cualquier mensaje o nota de voz, o usar /menu para ver más opciones. ¡A por ello!`,
        { parse_mode: 'Markdown' }
      );
    }

    // Crear usuario en DB
    await createUser(from.id, nombre);
    await updateUser(from.id, { nivel_actual: 1, estado: 'onboarding_native' });
    await initProgress(from.id);

    // Guardar el idioma detectado en ctx.session (in-memory para este paso)
    ctx.state.detectedLang     = langCode;
    ctx.state.detectedLangName = langName;

    await ctx.reply(
      `👋 ¡Hola, *${nombre}*! Soy *${settings.tutor.name}*, tu tutor personal de idiomas.\n\n` +
      `🌐 Detecté que tu dispositivo está en *${langName}*.\n` +
      `¿Es ese tu idioma nativo?`,
      {
        parse_mode: 'Markdown',
        ...confirmNativeLangKeyboard(langName),
      }
    );
  });

  // ── Confirmar idioma nativo detectado ─────────────────────────────────────
  bot.action('native_confirm', async (ctx) => {
    await ctx.answerCbQuery();
    const langCode = ctx.from.language_code || 'es';
    const langName = LANG_NAMES[langCode] || langCode;

    await updateUser(ctx.from.id, { idioma_nativo: langName });
    await setUserState(ctx.from.id, 'onboarding_target');

    await ctx.editMessageText(
      `✅ Perfecto. Tu idioma nativo es *${langName}*.\n\n` +
      `🎯 ¿Qué idioma quieres aprender?`,
      { parse_mode: 'Markdown', ...targetLangKeyboard() }
    );
  });

  // ── Cambiar idioma nativo ─────────────────────────────────────────────────
  bot.action('native_change', async (ctx) => {
    await ctx.answerCbQuery();
    await setUserState(ctx.from.id, 'onboarding_native');

    await ctx.editMessageText(
      `🌐 *Selecciona tu idioma nativo:*`,
      { parse_mode: 'Markdown', ...nativeLangKeyboard() }
    );
  });

  // ── Selección de idioma nativo desde teclado ──────────────────────────────
  for (const [action, lang] of Object.entries(NATIVE_LANGS)) {
    bot.action(action, async (ctx) => {
      await ctx.answerCbQuery();
      await updateUser(ctx.from.id, { idioma_nativo: lang });
      await setUserState(ctx.from.id, 'onboarding_target');

      await ctx.editMessageText(
        `✅ Idioma nativo guardado: *${lang}*.\n\n` +
        `🎯 ¿Qué idioma quieres aprender?`,
        { parse_mode: 'Markdown', ...targetLangKeyboard() }
      );
    });
  }

  // ── Selección de idioma objetivo ──────────────────────────────────────────
  for (const [action, lang] of Object.entries(TARGET_LANGS)) {
    bot.action(action, async (ctx) => {
      await ctx.answerCbQuery();
      
      const user = await getUser(ctx.from.id);
      
      const flagMap = {
        'inglés': '🇺🇸',
        'ruso': '🇷🇺',
        'francés': '🇫🇷',
        'japonés': '🇯🇵',
        'coreano': '🇰🇷',
        'portugués': '🇧🇷',
        'alemán': '🇩🇪',
        'italiano': '🇮🇹',
      };
      const flag = flagMap[lang] || '🌐';

      if (user && user.idioma_objetivo === lang && !['onboarding', 'onboarding_native', 'onboarding_target'].includes(user.estado)) {
        await setUserState(ctx.from.id, 'active');
        return ctx.editMessageText(
          `${flag} *¡Sigues aprendiendo ${lang}!*\n\n` +
          `Mantienes tu *Nivel ${user.nivel_actual || 1}* y todo tu progreso intacto.\n\n` +
          `✍️ Puedes enviarme un mensaje de texto o nota de voz en cualquier momento para continuar con tu lección.`,
          { parse_mode: 'Markdown' }
        );
      }

      await updateUser(ctx.from.id, { idioma_objetivo: lang });
      await setUserState(ctx.from.id, 'onboarding_level');

      await ctx.editMessageText(
        `${flag} ¡Excelente elección! Aprenderás *${lang}*.\n\n` +
        `📊 ¿Cuál es tu nivel actual?`,
        { parse_mode: 'Markdown', ...initialLevelKeyboard() }
      );
    });
  }

  // ── Nivel inicial: principiante ───────────────────────────────────────────
  bot.action('level_1', async (ctx) => {
    await ctx.answerCbQuery();
    await updateUser(ctx.from.id, { nivel_actual: 1, estado: 'active' });
    await openSession(ctx.from.id);

    const user = await getUser(ctx.from.id);

    await ctx.editMessageText(
      `🚀 ¡Empezamos desde cero! No te preocupes, llegarás muy lejos.\n\n` +
      `⏳ _Iniciando tu primera sesión con el Tutor ${settings.tutor.name}..._`,
      { parse_mode: 'Markdown' }
    );

    // Delay para dar una respuesta interactiva excelente
    await new Promise(r => setTimeout(r, 1000));

    // Enviar la tarjeta de nivel dinámica!
    await sendLevelCardImage(ctx, user, 1);

    // Delay corto
    await new Promise(r => setTimeout(r, 1500));

    // Gatillar la explicación y primer ejercicio del tutor automáticamente
    await triggerFirstTutorMessage(ctx, user, 1);
  });

  // ── Nivel inicial: detectar nivel ─────────────────────────────────────────
  bot.action('level_detect', async (ctx) => {
    await ctx.answerCbQuery();
    await updateUser(ctx.from.id, { nivel_actual: 1, estado: 'detecting_level' });

    await ctx.editMessageText(
      `📝 Voy a hacerte *5 preguntas rápidas* para estimar tu nivel.\n\n` +
      `*Pregunta 1 de 5:*\n\n` +
      `¿Cómo se dice "Ella trabaja en un hospital" en inglés?`,
      { parse_mode: 'Markdown' }
    );
  });
}
