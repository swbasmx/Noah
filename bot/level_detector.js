import { updateUser, openSession, getUser } from '../database/db.js';
import { getLevelCard } from '../ai/tutor.js';
import { settings } from '../config/settings.js';
import OpenAI from 'openai';

export const DETECTION_QUESTIONS = [
  {
    num: 1,
    original: 'Ella trabaja en un hospital',
    prompt: '¿Cómo se dice "Ella trabaja en un hospital" en inglés?',
  },
  {
    num: 2,
    original: 'Ayer fui al cine con mis amigos',
    prompt: '¿Cómo se dice "Ayer fui al cine con mis amigos" en inglés?',
  },
  {
    num: 3,
    original: 'He vivido aquí por cinco años',
    prompt: '¿Cómo se dice "He vivido aquí por cinco años" en inglés?',
  },
  {
    num: 4,
    original: 'Si tuviera más dinero, viajaría por el mundo',
    prompt: '¿Cómo se dice "Si tuviera más dinero, viajaría por el mundo" en inglés?',
  },
  {
    num: 5,
    original: 'El puente fue construido antes de que comenzara el invierno',
    prompt: '¿Cómo se dice "El puente fue construido antes de que comenzara el invierno" en inglés?',
  }
];

const onboardingSessions = new Map();

/**
 * Maneja el flujo interactivo de 5 preguntas para estimar el nivel del usuario.
 */
export async function handleLevelDetection(ctx, user, userMsg, openai) {
  const userId = user.id_telegram;
  
  if (!onboardingSessions.has(userId)) {
    onboardingSessions.set(userId, { currentQuestion: 1, correctCount: 0 });
  }

  const session = onboardingSessions.get(userId);
  const currentQ = DETECTION_QUESTIONS.find(q => q.num === session.currentQuestion);

  const checkingMsg = await ctx.reply('🔍 _Evaluando tu respuesta..._', { parse_mode: 'Markdown' });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un evaluador lingüístico de inglés muy amigable. Determina si la traducción del usuario de la frase en español dada es gramaticalmente correcta y conserva el significado original (ignora errores menores de puntuación o mayúsculas). Responde únicamente con un objeto JSON: { "correcta": true/false, "correccion": "frase correcta sugerida", "explicacion": "explicación en español amigable de 1 oración del error o felicitación" }'
        },
        {
          role: 'user',
          content: `Frase original: "${currentQ.original}"\nRespuesta del alumno: "${userMsg}"`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Eliminar indicador de carga
    await ctx.telegram.deleteMessage(ctx.chat.id, checkingMsg.message_id).catch(() => {});

    if (result.correcta) {
      session.correctCount++;
      await ctx.reply(`✅ *¡Excelente! Tu respuesta es correcta.* 🌟\n\n_"${userMsg}"_`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`💡 *Buen intento, pero se puede mejorar:*\n\n✗ _"${userMsg}"_\n✓ *"${result.correccion}"*\n\n👉 _${result.explicacion}_`, { parse_mode: 'Markdown' });
    }

    if (session.currentQuestion < 5) {
      session.currentQuestion++;
      const nextQ = DETECTION_QUESTIONS.find(q => q.num === session.currentQuestion);
      
      // Delay de 1s para mejor ritmo conversacional
      await new Promise(r => setTimeout(r, 1000));
      
      await ctx.reply(
        `📝 *Pregunta ${nextQ.num} de 5:*\n\n` +
        `${nextQ.prompt}`,
        { parse_mode: 'Markdown' }
      );
    } else {
      // Fin de la evaluación
      let startingLevel = 1;
      let cefrName = 'A1';
      
      if (session.correctCount === 2) {
        startingLevel = 16;
        cefrName = 'A2';
      } else if (session.correctCount === 3) {
        startingLevel = 31;
        cefrName = 'B1';
      } else if (session.correctCount === 4) {
        startingLevel = 51;
        cefrName = 'B2';
      } else if (session.correctCount >= 5) {
        startingLevel = 71;
        cefrName = 'C1';
      }

      await updateUser(userId, { nivel_actual: startingLevel, estado: 'active' });
      await openSession(userId);
      onboardingSessions.delete(userId);

      const levelCard = getLevelCard(startingLevel, user?.idioma_objetivo || 'inglés');

      await ctx.reply(
        `🎉 *¡Evaluación inicial completada con éxito!* 🎉\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 Respuestas correctas: *${session.correctCount}/5*\n` +
        `🎯 Nivel asignado: *${startingLevel} — ${levelCard?.nombre || 'Inicial'}*\n` +
        `📈 Equivalente CEFR: *${cefrName}*\n\n` +
        `🚀 *¡Felicitaciones!* Generando tu tarjeta de perfil y primera clase...`,
        { parse_mode: 'Markdown' }
      );

      // Delay corto
      await new Promise(r => setTimeout(r, 1000));

      // Enviar la tarjeta de nivel dinámica!
      await sendLevelCardImage(ctx, user, startingLevel);

      // Delay corto
      await new Promise(r => setTimeout(r, 1500));

      // Gatillar la explicación y primer ejercicio del tutor automáticamente
      await triggerFirstTutorMessage(ctx, user, startingLevel, openai);
    }

  } catch (err) {
    console.error('❌ [Level Detector] Error en evaluación:', err.message);
    await ctx.telegram.deleteMessage(ctx.chat.id, checkingMsg.message_id).catch(() => {});
    await ctx.reply('Ups, tuve un pequeño problema al conectar con el cerebro del tutor. Continuemos con el test. 🙏');
    
    if (session.currentQuestion < 5) {
      session.currentQuestion++;
      const nextQ = DETECTION_QUESTIONS.find(q => q.num === session.currentQuestion);
      await ctx.reply(`📝 *Pregunta ${nextQ.num} de 5:*\n\n${nextQ.prompt}`, { parse_mode: 'Markdown' });
    } else {
      await updateUser(userId, { nivel_actual: 1, estado: 'active' });
      await openSession(userId);
      onboardingSessions.delete(userId);
      await ctx.reply('¡Evaluación terminada! Empezaremos en el nivel 1. Escribe lo que quieras para comenzar. 😊');
    }
  }
}

/**
 * Llama a la IA para gatillar automáticamente la primera interacción del nivel,
 * presentando el tema gramatical, su explicación en español y el ejercicio 1.
 */
export async function triggerFirstTutorMessage(ctx, user, startingLevel, openai) {
  const userId = user.id_telegram;
  const levelCard = getLevelCard(startingLevel, user?.idioma_objetivo || 'inglés');
  if (!levelCard) return;

  const loadingMsg = await ctx.reply('👨‍🏫 _El tutor está preparando tu clase y explicando el tema..._ ⏳', { parse_mode: 'Markdown' });

  try {
    const { getTutorResponse } = await import('../ai/tutor.js');
    const { parseTutorResponse } = await import('../ai/evaluator.js');
    const { saveConversationTurn } = await import('../database/vector/collections.js');
    const { pushToHistory } = await import('./handlers.js');

    const openaiClient = openai || new OpenAI({ apiKey: settings.openai.apiKey });

    // Iniciar enviando una señal para que se presente
    const updatedUser = { ...user, nivel_actual: startingLevel, estado: 'active' };
    const rawResponse = await getTutorResponse(openaiClient, updatedUser, [], "¡Hola! Estoy muy entusiasmado de comenzar mi clase.");

    const { visibleText } = parseTutorResponse(rawResponse);

    // Guardar en el historial local para persistencia de la sesión de chat
    pushToHistory(userId, 'assistant', rawResponse);

    // Eliminar cargando
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    // Enviar el mensaje inicial del tutor con el tema explicado en español y el ejercicio 1
    await ctx.reply(
      `👨‍🏫 *Tutor ${settings.tutor.name} (Nivel ${startingLevel}):*\n\n` +
      visibleText,
      { parse_mode: 'Markdown' }
    );

    // Guardar también en la base vectorial ChromaDB
    await saveConversationTurn(userId, "¡Hola! Estoy listo para comenzar.", visibleText, startingLevel);

  } catch (err) {
    console.error('❌ Error al gatillar primera interacción del tutor:', err.message);
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
    await ctx.reply(`👨‍🏫 *Tutor ${settings.tutor.name}:*\n\nWelcome to Level ${startingLevel}! Let's start practicing.`);
  }
}

/**
 * Obtiene o genera una tarjeta de perfil dinámica y la envía como foto en Telegram.
 */
export async function sendLevelCardImage(ctx, user, level) {
  const userId = user.id_telegram;
  const levelCard = getLevelCard(level, user?.idioma_objetivo || 'inglés');
  if (!levelCard) return;

  const statusMsg = await ctx.reply('🎨 _Generando tu tarjeta de rango exclusiva..._ ⏳', { parse_mode: 'Markdown' });

  try {
    // 1. Obtener la foto de perfil del usuario de Telegram
    let avatarUrl = 'https://avatars.githubusercontent.com/u/159487561?v=4';
    try {
      const photos = await ctx.telegram.getUserProfilePhotos(userId, { limit: 1 });
      if (photos && photos.total_count > 0) {
        const fileId = photos.photos[0][0].file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);
        avatarUrl = fileLink.href;
      }
    } catch (avatarErr) {
      console.warn('⚠️ No se pudo obtener el avatar real de Telegram:', avatarErr.message);
    }

    // 2. Obtener estadísticas reales para el progreso
    const { getProgress } = await import('../database/db.js');
    const progress = (await getProgress(userId)) || { palabras_totales_aprendidas: 0 };
    const exp = progress.palabras_totales_aprendidas || 0;
    const requireExp = Math.max(100, exp + 50);

    // 3. Formatear parámetros
    const nameParam = encodeURIComponent(user.nombre || 'Alumno');
    const backgroundUrl = encodeURIComponent('https://i.pinimg.com/originals/5d/e3/a2/5de3a256957e356622bedb439ab2a8e5.png');
    const rankName = encodeURIComponent(`${levelCard.cefr.toUpperCase()} - ${levelCard.nombre.slice(0, 15)}`);
    const rankId = 0;

    const apiUrl = `https://api.siputzx.my.id/api/canvas/profile` +
      `?backgroundURL=${backgroundUrl}` +
      `&avatarURL=${encodeURIComponent(avatarUrl)}` +
      `&rankName=${rankName}` +
      `&rankId=${rankId}` +
      `&exp=${exp}` +
      `&requireExp=${requireExp}` +
      `&level=${level}` +
      `&name=${nameParam}`;

    console.log(`🎨 Generando tarjeta de perfil Canvas para Nivel ${level}...`);

    // 4. Descargar la imagen
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API Canvas retornó estatus ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Borrar estado temporal
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

    // 5. Enviar la foto al chat
    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `🏆 *¡NIVEL DESBLOQUEADO!* 🏆\n` +
        `📖 Has alcanzado el *Nivel ${level}* en tu aprendizaje.\n` +
        `✨ ¡Sigue así, *${user.nombre}*! Tu racha y vocabulario siguen subiendo. 🚀`,
      parse_mode: 'Markdown'
    });

  } catch (err) {
    console.error('❌ Error al generar o enviar la tarjeta Canvas:', err.message);
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    // Si falla la imagen, al menos enviar un mensaje alternativo para no romper la experiencia
    await ctx.reply(`🏆 *¡Nivel ${level} alcanzado!* 🏆\n📖 *Tema:* ${levelCard.nombre} (${levelCard.cefr.toUpperCase()})`, { parse_mode: 'Markdown' });
  }
}
