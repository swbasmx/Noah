import {
  getUser,
  touchSession,
  getProgress,
  getTopErrors,
  saveError,
  checkAndLevelUp,
  openSession,
  closeSession,
  incrementProgress,
  getActiveSession,
  updateUser
} from '../database/db.js';
import { mainMenuKeyboard, targetLangKeyboard } from './menus.js';
import { settings } from '../config/settings.js';
import { getTutorResponseStream, getLevelCard } from '../ai/tutor.js';
import { parseTutorResponse } from '../ai/evaluator.js';
import { saveConversationTurn, saveErrorToVector } from '../database/vector/collections.js';
import { transcribeVoice } from '../voice/transcriber.js';
import { handleLevelDetection } from './level_detector.js';

// Historial en memoria por usuario: Map<userId, Array<{role, content}>>
const histories = new Map();

export function getHistory(userId) {
  if (!histories.has(userId)) histories.set(userId, []);
  return histories.get(userId);
}

export function pushToHistory(userId, role, content) {
  const hist = getHistory(userId);
  hist.push({ role, content });
  const max = settings.session.maxHistory * 2;
  if (hist.length > max) hist.splice(0, hist.length - max);
}

/**
 * Obtiene o crea la sesión de base de datos activa para el usuario.
 */
async function getOrCreateActiveSession(userId) {
  let session = await getActiveSession(userId);
  if (!session) {
    const id = await openSession(userId);
    session = { id, id_usuario: userId, mensajes_totales: 0, errores_sesion: '[]', palabras_nuevas_usadas: '[]', listo_para_subir: 0 };
  }
  return session;
}

/**
 * Registra los handlers principales de mensajes en el bot de Telegraf.
 */
export function registerHandlers(bot, openai) {

  // ── Comando /menu ─────────────────────────────────────────────────────────
  bot.command('menu', async (ctx) => {
    await ctx.reply('📋 *Menú principal*', {
      parse_mode: 'Markdown',
      ...mainMenuKeyboard(),
    });
  });

  // ── Comando /progreso ─────────────────────────────────────────────────────
  bot.command('progreso', async (ctx) => {
    const user  = await getUser(ctx.from.id);
    const prog  = await getProgress(ctx.from.id);
    const errs  = await getTopErrors(ctx.from.id, 5);

    if (!user || ['onboarding', 'onboarding_native'].includes(user.estado)) {
      return ctx.reply('Primero completa la configuración inicial con /start 😊');
    }

    const errLines = errs.length
      ? errs.map(e => `  ✗ _"${e.error_texto}"_ → ✓ "${e.correccion}" (×${e.veces_repetido})`).join('\n')
      : '  Ninguno aún 🎉';

    const levelCard = getLevelCard(user.nivel_actual, user.idioma_objetivo);

    await ctx.reply(
      `📊 *Tu progreso con ${settings.tutor.name}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎯 Nivel actual: *${user.nivel_actual} — ${levelCard?.nombre || 'Cargando...'}*\n` +
      `📈 Equivalente CEFR: *${levelCard?.cefr || 'A1'}*\n` +
      `🔥 Racha: *${user.racha_dias} día(s)* consecutivos\n` +
      `📚 Palabras aprendidas: *${prog?.palabras_totales_aprendidas ?? 0}*\n` +
      `💬 Sesiones completadas: *${prog?.sesiones_totales ?? 0}*\n` +
      `⚠️ Errores frecuentes:\n${errLines}`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── Comando /level ────────────────────────────────────────────────────────
  bot.command('level', async (ctx) => {
    const userId = ctx.from.id;
    const user   = await getUser(userId);
    if (!user) return ctx.reply('Primero inicia el bot con /start 😊');

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length === 0) {
      const levelCard = getLevelCard(user.nivel_actual, user.idioma_objetivo);
      return ctx.reply(
        `🎯 *Tu nivel actual:* Nivel *${user.nivel_actual}* (${levelCard?.cefr || 'A1'})\n` +
        `📖 *Tema:* ${levelCard?.nombre || 'General'}\n\n` +
        `💡 Para cambiar tu nivel, escribe: \`/level <1-100>\`\n` +
        `Por ejemplo: \`/level 5\``,
        { parse_mode: 'Markdown' }
      );
    }

    const newLvl = parseInt(args[0]);
    if (isNaN(newLvl) || newLvl < 1 || newLvl > 100) {
      return ctx.reply('⚠️ Por favor introduce un nivel válido entre 1 y 100.');
    }

    // Actualizar nivel
    await updateUser(userId, { nivel_actual: newLvl, estado: 'active' });
    await openSession(userId);

    // Limpiar historial
    histories.delete(userId);

    const newCard = getLevelCard(newLvl, user.idioma_objetivo);

    await ctx.reply(
      `🎯 *Nivel cambiado con éxito!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📈 *Nuevo Nivel:* ${newLvl} — ${newCard?.nombre || 'General'}\n` +
      `📊 *Equivalente CEFR:* ${newCard?.cefr || 'A1'}\n\n` +
      `🚀 *¡Todo listo!* Generando tu tarjeta de rango y clase...`,
      { parse_mode: 'Markdown' }
    );

    // Delay e iniciar clase
    await new Promise(r => setTimeout(r, 1000));
    const { sendLevelCardImage, triggerFirstTutorMessage } = await import('./level_detector.js');
    await sendLevelCardImage(ctx, user, newLvl);
    await new Promise(r => setTimeout(r, 1500));
    await triggerFirstTutorMessage(ctx, user, newLvl, openai);
  });

  // ── Comando /infot ────────────────────────────────────────────────────────
  bot.command('infot', async (ctx) => {
    const userId = ctx.from.id;
    const user   = await getUser(userId);
    const prog   = await getProgress(userId);
    if (!user) return ctx.reply('Primero inicia el bot con /start 😊');

    const levelCard = getLevelCard(user.nivel_actual, user.idioma_objetivo);

    await ctx.reply(
      `🤖 *Noah — Tu Tutor Inteligente de Idiomas* 📖\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Alumno:* ${user.nombre}\n` +
      `🎯 *Nivel:* ${user.nivel_actual} (${levelCard?.cefr || 'A1'})\n` +
      `🔥 *Racha actual:* ${user.racha_dias} día(s)\n` +
      `📚 *Vocabulario total aprendido:* ${prog?.palabras_totales_aprendidas ?? 0} palabras\n` +
      `💬 *Sesiones completadas:* ${prog?.sesiones_totales ?? 0} clases\n` +
      `⏱️ *Tiempo total de estudio:* ${prog?.tiempo_total_minutos ?? 0} minutos\n\n` +
      `💡 Noah utiliza IA avanzada con feedback en español paso a paso. Puedes usar /menu en cualquier momento para ver más opciones.`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── Comando /clear ────────────────────────────────────────────────────────
  bot.command('clear', async (ctx) => {
    const userId = ctx.from.id;
    const user   = await getUser(userId);
    if (!user) return ctx.reply('Primero inicia el bot con /start 😊');

    await ctx.reply(
      `⚠️ *¿Estás seguro de que deseas eliminar el historial de tu lección actual?*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Se borrará la memoria reciente del tutor para tu nivel actual y la lección se reiniciará desde cero. Tu progreso general no se perderá.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Sí, reiniciar', callback_data: 'confirm_clear_yes' },
              { text: '❌ No, cancelar', callback_data: 'confirm_clear_no' }
            ]
          ]
        }
      }
    );
  });

  // ── Comando /language / /languaje ──────────────────────────────────────────
  bot.command(['language', 'languaje'], async (ctx) => {
    const userId = ctx.from.id;
    const user   = await getUser(userId);
    if (!user) return ctx.reply('Primero inicia el bot con /start 😊');

    const { setUserState } = await import('../database/db.js');
    await setUserState(userId, 'onboarding_target');

    await ctx.reply(
      `🎯 *Cambiar idioma a aprender*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `¿Qué idioma te gustaría aprender con Noah hoy? Selecciona una de las opciones:`,
      {
        parse_mode: 'Markdown',
        ...targetLangKeyboard()
      }
    );
  });

  // ── Comando /info ─────────────────────────────────────────────────────────
  bot.command('info', async (ctx) => {
    await ctx.reply(
      `🤖 *Noah Language Bot — Tu Tutor Inteligente* 🎓\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*¿De qué trata este bot?*\n` +
      `Noah es un sistema conversacional interactivo diseñado para enseñarte idiomas de manera natural. Mediante inteligencia artificial avanzada, Noah te explica temas de gramática en español, te plantea ejercicios secuenciales (del 1 al 5) y corrige todos tus errores al instante, tanto por texto como por notas de voz.\n\n` +
      `🎯 *Propósito:*\n` +
      `Proporcionar un espacio seguro, amigable y sumamente interactivo para practicar expresión oral y escrita. Olvídate de los cuestionarios aburridos; con Noah aprendes conversando sobre situaciones reales, recibiendo medallas y tarjetas de rango dinámicas a medida que progresas de nivel en nivel.\n\n` +
      `👨‍💻 *Creador y Desarrollo:*\n` +
      `Creado con 💖 por el equipo de *Noah Language Project* como el tutor de supervivencia y maestría definitivo.\n\n` +
      `🚀 *Comandos rápidos a tu disposición:*\n` +
      `• /start - Iniciar configuración\n` +
      `• /menu - Menú interactivo\n` +
      `• /level - Cambiar o ver nivel actual\n` +
      `• /infot - Estadísticas de estudio\n` +
      `• /language - Cambiar idioma a aprender\n` +
      `• /clear - Reiniciar lección actual`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── Callback: ver progreso desde menú inline ──────────────────────────────
  bot.action('menu_progress', async (ctx) => {
    await ctx.answerCbQuery();
    const user  = await getUser(ctx.from.id);
    const prog  = await getProgress(ctx.from.id);
    const errs  = await getTopErrors(ctx.from.id, 5);
    const levelCard = getLevelCard(user?.nivel_actual || 1, user?.idioma_objetivo || 'inglés');

    const errLines = errs.length
      ? errs.map(e => `  ✗ _"${e.error_texto}"_ → ✓ "${e.correccion}" (×${e.veces_repetido})`).join('\n')
      : '  Ninguno aún 🎉';

    await ctx.reply(
      `📊 *Tu progreso con ${settings.tutor.name}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎯 Nivel actual: *${user?.nivel_actual ?? 1} — ${levelCard?.nombre || 'Cargando...'}*\n` +
      `📈 Equivalente CEFR: *${levelCard?.cefr || 'A1'}*\n` +
      `🔥 Racha: *${user?.racha_dias ?? 0} día(s)*\n` +
      `📚 Palabras aprendidas: *${prog?.palabras_totales_aprendidas ?? 0}*\n` +
      `⚠️ Errores frecuentes:\n${errLines}`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── Callback: modo libre ──────────────────────────────────────────────────
  bot.action('menu_free_mode', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      '💬 *Modo conversación libre activado.*\n' +
      'Chatea conmigo sobre cualquier tema. Seguiré corrigiendo tus errores de forma natural. ' +
      'Escribe /menu para volver al menú.',
      { parse_mode: 'Markdown' }
    );
  });

  // ── Callback: cambiar idioma ──────────────────────────────────────────────
  bot.action('menu_change_lang', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      '🔄 Para cambiar el idioma, usa /start de nuevo.',
      { parse_mode: 'Markdown' }
    );
  });

  // ── Callback: ver errores frecuentes ─────────────────────────────────────
  bot.action('menu_errors', async (ctx) => {
    await ctx.answerCbQuery();
    const errs = await getTopErrors(ctx.from.id, 5);
    if (!errs.length) {
      return ctx.reply('¡Sin errores registrados todavía! 🎉');
    }
    const lines = errs.map((e, i) =>
      `${i + 1}. ✗ _"${e.error_texto}"_\n   ✓ "${e.correccion}" (×${e.veces_repetido} veces)`
    ).join('\n\n');

    await ctx.reply(`⚠️ *Tus errores más frecuentes:*\n\n${lines}`, { parse_mode: 'Markdown' });
  });

  // ── Callback: confirmar eliminación de historial ────────────────────────
  bot.action('confirm_clear_yes', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const user   = await getUser(userId);
    if (!user) return;

    // 1. Borrar historial en memoria
    histories.delete(userId);

    // 2. Abrir nueva sesión
    await openSession(userId);

    await ctx.editMessageText(
      `🧹 *¡Historial y sesión de lección eliminados con éxito!*\n` +
      `Tu lección actual del Nivel *${user.nivel_actual}* se reiniciará desde cero.\n\n` +
      `⏳ _Preparando la lección..._`,
      { parse_mode: 'Markdown' }
    );

    // Delay y reiniciar clase
    await new Promise(r => setTimeout(r, 1500));
    const { triggerFirstTutorMessage } = await import('./level_detector.js');
    await triggerFirstTutorMessage(ctx, user, user.nivel_actual, openai);
  });

  bot.action('confirm_clear_no', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `❌ *Acción cancelada.*\n` +
      `Tu lección actual no ha sido modificada. ¡Puedes seguir conversando normalmente!`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── Manejo de notas de voz ────────────────────────────────────────────────
  bot.on('voice', async (ctx) => {
    const userId = ctx.from.id;
    const user   = await getUser(userId);

    if (!user || !['active', 'detecting_level'].includes(user.estado)) return;

    const msg = await ctx.reply('🎙️ _Escuchando tu voz..._', { parse_mode: 'Markdown' });

    try {
      // 1. Transcribir el mensaje de voz a texto
      const text = await transcribeVoice(ctx, ctx.message.voice.file_id);
      
      // 2. Notificar la transcripción al usuario
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msg.message_id,
        null,
        `🎤 *Dijiste:* _"${text}"_\n\n⏳ _Generando respuesta del tutor..._`,
        { parse_mode: 'Markdown' }
      );

      // 3. Procesar el texto
      if (user.estado === 'detecting_level') {
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
        await handleLevelDetection(ctx, user, text, openai);
      } else {
        await processTextChat(ctx, user, text, openai, msg.message_id);
      }

    } catch (err) {
      console.error('❌ [Voice Handler] Error:', err.message);
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msg.message_id,
        null,
        '❌ No pude procesar tu nota de voz. Asegúrate de hablar claro y de que el audio sea de buena calidad.'
      );
    }
  });

  // ── Mensajes de texto normal ──────────────────────────────────────────────
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const user   = await getUser(userId);

    if (!user || !['active', 'detecting_level'].includes(user.estado)) return;

    if (user.estado === 'detecting_level') {
      await handleLevelDetection(ctx, user, ctx.message.text, openai);
    } else {
      await ctx.sendChatAction('typing');
      await processTextChat(ctx, user, ctx.message.text, openai);
    }
  });
}

/**
 * Procesa la conversación del alumno, realiza la llamada a GPT con contexto de ChromaDB,
 * guarda los errores y el historial en bases de datos vectoriales y SQL, y gestiona subidas de nivel.
 */
async function processTextChat(ctx, user, userMsg, openai, statusMsgId = null) {
  const userId = user.id_telegram;
  await touchSession(userId);

  pushToHistory(userId, 'user', userMsg);

  try {
    // 1. Iniciar un mensaje de respuesta interactivo
    const prefix = statusMsgId ? `🎤 *Dijiste:* _"${userMsg}"_\n\n` : '';
    let messageToSend = prefix + `✍️ _Tutor ${settings.tutor.name} está escribiendo..._`;
    let sentMsg;

    if (statusMsgId) {
      sentMsg = await ctx.telegram.editMessageText(ctx.chat.id, statusMsgId, null, messageToSend, { parse_mode: 'Markdown' });
    } else {
      sentMsg = await ctx.reply(messageToSend, { parse_mode: 'Markdown' });
    }

    // 2. Llamar a OpenAI en formato Streaming
    const stream = await getTutorResponseStream(openai, user, getHistory(userId), userMsg);

    let rawResponse = '';
    let visibleText = '';
    let lastSentText = '';
    let lastEditTime = Date.now();

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (!content) continue;

      rawResponse += content;

      // Filtrar el bloque de evaluación para evitar que se renderice en vivo
      const evalTagIndex = rawResponse.indexOf('<eval>');
      if (evalTagIndex !== -1) {
        visibleText = rawResponse.slice(0, evalTagIndex);
      } else {
        visibleText = rawResponse;
      }

      // Actualizar el mensaje de Telegram periódicamente (cada 800ms) para evitar limites de Telegram
      const trimmedText = visibleText.trim();
      if (trimmedText && trimmedText !== lastSentText && Date.now() - lastEditTime > 800) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          sentMsg.message_id,
          null,
          prefix + trimmedText,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
        
        lastSentText = trimmedText;
        lastEditTime = Date.now();
      }
    }

    // 3. Renderizar el mensaje final completo
    const { visibleText: finalVisible, evaluation } = parseTutorResponse(rawResponse);
    if (prefix + finalVisible !== lastSentText) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        sentMsg.message_id,
        null,
        prefix + finalVisible,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }

    pushToHistory(userId, 'assistant', rawResponse);

    // 4. Si hay evaluación, procesar los datos pedagógicos
    if (evaluation) {
      const activeSession = await getOrCreateActiveSession(userId);

      // Guardar en ChromaDB el par conversacional
      await saveConversationTurn(userId, userMsg, finalVisible, user.nivel_actual);

      // Procesar errores detectados
      let sessionErrors = [];
      if (activeSession.errores_sesion) {
        sessionErrors = Array.isArray(activeSession.errores_sesion)
          ? activeSession.errores_sesion
          : JSON.parse(activeSession.errores_sesion || '[]');
      }

      if (evaluation.errores_detectados && evaluation.errores_detectados.length > 0) {
        for (const err of evaluation.errores_detectados) {
          // Guardar en Base de Datos activa
          await saveError(userId, {
            error_texto: err.error,
            correccion: err.correccion,
            tipo_error: err.tipo,
            tema: err.tema,
            nivel: user.nivel_actual,
          });

          // Guardar en ChromaDB
          await saveErrorToVector(userId, {
            error: err.error,
            correccion: err.correccion,
            tipo: err.tipo,
            tema: err.tema,
            nivel: user.nivel_actual,
          });

          sessionErrors.push(err);
        }
      }

      // Procesar palabras del nivel utilizadas
      let sessionWords = [];
      if (activeSession.palabras_nuevas_usadas) {
        sessionWords = Array.isArray(activeSession.palabras_nuevas_usadas)
          ? activeSession.palabras_nuevas_usadas
          : JSON.parse(activeSession.palabras_nuevas_usadas || '[]');
      }

      if (evaluation.palabras_nivel_usadas_correctamente && evaluation.palabras_nivel_usadas_correctamente.length > 0) {
        for (const w of evaluation.palabras_nivel_usadas_correctamente) {
          if (!sessionWords.includes(w)) sessionWords.push(w);
        }
        // Incrementar el progreso acumulado en palabras
        await incrementProgress(userId, { palabras: evaluation.palabras_nivel_usadas_correctamente.length });
      }

      // Actualizar sesión activa
      const readyToLevelUp = evaluation.listo_para_subir_de_nivel ? 1 : 0;
      await closeSession(activeSession.id, {
        mensajes_totales: (activeSession.mensajes_totales || 0) + 1,
        errores_sesion: sessionErrors,
        palabras_nuevas_usadas: sessionWords,
        listo_para_subir: readyToLevelUp,
      });

      // 5. Gestionar la progresión de niveles
      const nextLevel = await checkAndLevelUp(userId, settings.session.sessionsToLevelUp);
      if (nextLevel) {
        // La sesión se cierra oficialmente con éxito
        await closeSession(activeSession.id, {
          mensajes_totales: (activeSession.mensajes_totales || 0) + 1,
          errores_sesion: sessionErrors,
          palabras_nuevas_usadas: sessionWords,
          subio_de_nivel: 1,
          listo_para_subir: 1,
        });

        // Actualizar estadísticas globales
        await incrementProgress(userId, { sesiones: 1, minutes: 15 });

        // Abrir una nueva sesión para el nuevo nivel
        await openSession(userId);

        const newCard = getLevelCard(nextLevel, user.idioma_objetivo);

        // Mensaje interactivo de felicitación de subida de nivel
        setTimeout(async () => {
          const { sendLevelCardImage, triggerFirstTutorMessage } = await import('./level_detector.js');

          // Enviar la tarjeta de nivel dinámica!
          await sendLevelCardImage(ctx, user, nextLevel);

          await ctx.reply(
            `🎉🏆 *¡FELICIDADES! Subiste al Nivel ${nextLevel}* 🏆🎉\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🎯 *Tema:* ${newCard?.nombre || 'Siguiente nivel'} (${newCard?.cefr || 'A2'})\n` +
            `📝 *Descripción:* ${newCard?.descripcion || 'Continúa aprendiendo.'}\n\n` +
            `🚀 *¡Excelente trabajo!* Iniciando tu clase a continuación...`,
            { parse_mode: 'Markdown' }
          );

          // Delay de 1.5s antes de gatillar la primera clase dinámica del nuevo nivel
          await new Promise(r => setTimeout(r, 1500));
          await triggerFirstTutorMessage(ctx, user, nextLevel, openai);
        }, 1000);
      }
    }
  } catch (err) {
    console.error('❌ [processTextChat Stream] Error:', err.message);
    await ctx.reply('⚠️ Hubo un error de procesamiento. Sigamos conversando.');
  }
}
