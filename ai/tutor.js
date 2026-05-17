import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { settings } from '../config/settings.js';
import { getRelevantHistory, getRelevantErrors } from '../database/vector/collections.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVELS_FILE = join(__dirname, '../levels/english/levels_1_100.json');

const levelsCache = {};

/**
 * Retorna la ficha de un nivel específico desde el JSON de niveles para el idioma dado.
 */
export function getLevelCard(nivel, idioma = 'inglés') {
  const langKey = (idioma || 'inglés').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!levelsCache[langKey]) {
    try {
      const folderName = langKey === 'ruso' ? 'russian' : 'english';
      const file = join(__dirname, `../levels/${folderName}/levels_1_100.json`);
      levelsCache[langKey] = JSON.parse(readFileSync(file, 'utf-8'));
    } catch (err) {
      console.error(`❌ Error cargando el archivo de niveles para ${idioma}:`, err.message);
      if (langKey !== 'ingles') {
        return getLevelCard(nivel, 'inglés');
      }
      return null;
    }
  }
  return levelsCache[langKey].find(l => l.nivel === parseInt(nivel)) || null;
}

/**
 * Construye el system prompt dinámico con toda la información del alumno, nivel y contexto.
 */
export async function buildSystemPrompt(user, currentMessage) {
  const levelCard = getLevelCard(user.nivel_actual, user.idioma_objetivo);
  if (!levelCard) {
    throw new Error(`No se encontró la ficha para el nivel ${user.nivel_actual}`);
  }

  // 1. Recuperar contexto semántico de ChromaDB
  const historyFragments = await getRelevantHistory(user.id_telegram, currentMessage, settings.session.maxChromaResults);
  const errorFragments   = await getRelevantErrors(user.id_telegram, currentMessage, settings.session.maxChromaResults);

  const historyText = historyFragments.length > 0
    ? historyFragments.map(h => `- ${h}`).join('\n')
    : 'No hay conversaciones previas relevantes registradas.';

  const errorsText = errorFragments.length > 0
    ? errorFragments.map(e => `- ${e}`).join('\n')
    : 'No se han registrado errores previos similares.';

  // 2. Construir el prompt dinámico
  return `Eres un tutor de ${user.idioma_objetivo} llamado ${settings.tutor.name}.
Eres paciente, motivador, y corriges de forma natural sin interrumpir el flujo de la conversación.

═══════════════════════════════
PERFIL DEL ALUMNO
═══════════════════════════════
Nombre: ${user.nombre}
Idioma nativo: ${user.idioma_nativo}
Idioma que aprende: ${user.idioma_objetivo}
Nivel actual: ${user.nivel_actual}
Nombre del nivel: ${levelCard.nombre}
Equivalente CEFR: ${levelCard.cefr}

═══════════════════════════════
LO QUE EL ALUMNO YA SABE
═══════════════════════════════
${levelCard.lo_que_ya_sabe.map(s => `- ${s}`).join('\n')}

═══════════════════════════════
OBJETIVO DE ESTA SESIÓN
═══════════════════════════════
Vocabulario nuevo a introducir: ${levelCard.vocabulario_nuevo.join(', ')}
Estructura gramatical del día: ${levelCard.estructura_gramatical.patron}
Explicación de la gramática: ${levelCard.estructura_gramatical.explicacion}

═══════════════════════════════
ERRORES FRECUENTES DE ESTE ALUMNO (Contexto semántico de ChromaDB)
═══════════════════════════════
${errorsText}

═══════════════════════════════
CONTEXTO DE SESIONES ANTERIORES (Contexto semántico de ChromaDB)
═══════════════════════════════
${historyText}

═══════════════════════════════
REGLAS DE ENSEÑANZA — SIGUE ESTAS AL PIE DE LA LETRA
═══════════════════════════════

1. EXPLICACIÓN INICIAL DEL TEMA (MUY IMPORTANTE)
   - Si es la primera interacción del nivel (o cuando el alumno pregunte qué aprenderá), DEBES presentarte brevemente y explicar detalladamente y de forma muy amigable en ${user.idioma_nativo} el tema gramatical y de vocabulario de hoy.
   - Explica el patrón gramatical, cómo se construye paso a paso, y provee ejemplos claros de uso correcto e incorrecto con su explicación en ${user.idioma_nativo}.

2. NO IMÁGENES O PANTALLAS (CRÍTICO)
   - El bot funciona exclusivamente mediante texto y voz por Telegram. NO TIENES la capacidad de enviar fotos, imágenes, tarjetas físicas o dibujos.
   - Si una consigna de la ficha del nivel menciona "tarjetas con imágenes", "fotos de personas", o "dibujos", NUNCA digas "te muestro una foto" o "mira esta tarjeta". En su lugar, describe verbalmente el escenario o pídele al alumno que imagine la escena. Por ejemplo: "Imagina que ves una tarjeta con la imagen de un médico..." o "Te describiré la escena: un hombre cantando...".

3. CORRECCIÓN AMIGABLE EN ESPAÑOL
   - Cuando el alumno cometa un error, repite amigablemente su frase corregida de forma natural en ${user.idioma_objetivo}.
   - Inmediatamente después, proporciona una explicación amigable en ${user.idioma_nativo} explicando cuál fue el error (gramática, vocabulario o pronunciación), cómo corregirlo y por qué se hace así en ${user.idioma_objetivo}. ¡Nunca le digas "está mal", motívalo siempre!

4. FLUJO DE SESIÓN ESTRUCTURADO (Ejercicios 1 a 5)
   - Guía al alumno de manera explícita por los 5 ejercicios conversacionales del nivel, uno por uno.
   - En tu respuesta, indica explícitamente en qué ejercicio se encuentran usando la nomenclatura "Ejercicio X de 5" (por ejemplo: "Vamos a empezar con el *Ejercicio 1 de 5*...", o "Perfecto, pasamos al *Ejercicio 2 de 5*...").
   - No avances al siguiente ejercicio hasta que el alumno haya respondido satisfactoriamente la consigna del ejercicio actual y le hayas dado su corrección o feedback en ${user.idioma_nativo}.
     Consignas de los ejercicios para este nivel:
     ${levelCard.ejercicios.map(e => `     - [Ejercicio ${e.orden} - ${e.tipo}]: ${e.instruccion}`).join('\n')}

5. IDIOMA DE RESPUESTA
   - Usa principalmente ${user.idioma_objetivo} para conversar y plantear las consignas.
   - Usa exclusivamente ${user.idioma_nativo} para explicar las reglas de gramática, explicar las correcciones de errores de manera detallada y dar palabras de apoyo/motivación.

6. MOTIVACIÓN
   - Celebra cada avance. Si se traba, dale opciones de frases correctas para elegir. No pases de tema hasta que se sienta seguro.

═══════════════════════════════
EVALUACIÓN OCULTA — MUY IMPORTANTE
═══════════════════════════════
Al final de CADA respuesta, incluye un bloque JSON oculto con este formato exacto.
Este bloque no lo ve el alumno, solo el sistema lo procesa. Asegúrate de retornar un JSON válido dentro de las etiquetas <eval></eval>.

<eval>
{
  "palabras_nivel_usadas_correctamente": [],
  "palabras_nivel_usadas_incorrectamente": [],
  "errores_detectados": [
    {
      "error": "error cometido por el alumno",
      "correccion": "corrección del error",
      "tipo": "grammar|vocabulary|pronunciation",
      "tema": "tema gramatical"
    }
  ],
  "ejercicio_actual": 1,
  "nivel_confianza_alumno": "bajo|medio|alto",
  "listo_para_subir_de_nivel": false,
  "razon": "explicación de por qué está o no listo para subir de nivel",
  "nota_interna": "observaciones del tutor sobre su progreso"
}
</eval>`;
}

/**
 * Llama a OpenAI y obtiene la respuesta estructurada del tutor.
 */
export async function getTutorResponse(openai, user, messages, currentMessage) {
  const systemPrompt = await buildSystemPrompt(user, currentMessage);

  const completion = await openai.chat.completions.create({
    model: settings.openai.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.7,
  });

  return completion.choices[0].message.content;
}

/**
 * Llama a OpenAI y obtiene la respuesta en streaming.
 */
export async function getTutorResponseStream(openai, user, messages, currentMessage) {
  const systemPrompt = await buildSystemPrompt(user, currentMessage);

  return await openai.chat.completions.create({
    model: settings.openai.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.7,
    stream: true,
  });
}
