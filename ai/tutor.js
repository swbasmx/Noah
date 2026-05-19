import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { settings } from '../config/settings.js';
import { getRelevantHistory, getRelevantErrors } from '../database/vector/collections.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVELS_FILE = join(__dirname, '../levels/english/levels_1_30.json');

const levelsCache = {};

/**
 * Retorna la ficha de un nivel específico desde el JSON de niveles para el idioma dado.
 */
export function getLevelCard(nivel, idioma = 'inglés') {
  const langKey = (idioma || 'inglés').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!levelsCache[langKey]) {
    try {
      const folderMap = {
        'ingles': 'english',
        'ruso': 'russian',
        'frances': 'french',
        'japones': 'japanese',
        'coreano': 'korean',
        'portugues': 'portuguese',
        'aleman': 'german',
        'italiano': 'italian'
      };
      const folderName = folderMap[langKey] || 'english';
      const fileName = folderName === 'english' ? 'levels_1_30.json' : 'levels_1_100.json';
      const file = join(__dirname, `../levels/${folderName}/${fileName}`);
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
OBJETIVO DE ESTA SESIÓN (APRENDIZAJE ADAPTATIVO)
═══════════════════════════════
Objetivo Comunicativo / Descripción del nivel: ${levelCard.enfoque_conversacional ? levelCard.enfoque_conversacional.objetivo_comunicativo : levelCard.descripcion}
Vocabulario / Frases clave a introducir: ${(levelCard.vocabulario_funcional || levelCard.vocabulario_nuevo || []).join(', ')}
Enfoque gramatical / Explicación amigable: ${levelCard.enfoque_conversacional ? levelCard.enfoque_conversacional.explicacion_amigable : (levelCard.estructura_gramatical ? levelCard.estructura_gramatical.explicacion : '')}

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

1. FASE DE ENSEÑANZA (PRIMER MENSAJE O CUANDO PIDE AYUDA)
   - Cuando inicies un nivel por primera vez, tu ÚNICO objetivo es ENSEÑAR.
   - Háblale en ${user.idioma_nativo}. Explícale de forma muy detallada y amigable el "Objetivo Comunicativo" del nivel.
   - Enséñale cómo usar el "Vocabulario / Frases clave". Da ejemplos claros.
   - Termina SIEMPRE preguntando: "¿Todo claro hasta aquí? ¿Listo para empezar a practicar?".

2. FASE DE PRÁCTICA Y EJERCICIOS (SOLO DESPUÉS DE LA ENSEÑANZA)
   - Transforma las consignas en Roleplays Inmersivos. (Ej: ESTILO PRAKTIKA).
   - NUNCA le dictes la frase exacta que debe decir. Plantéale el escenario de forma abierta.
   - CORRECTO: "Imagina que eres un turista y yo soy el recepcionista de un hotel en Nueva York. ¿Cómo me saludarías para hacer el check-in y cómo me dirías tu nombre?"
   - INCORRECTO: "Di 'Hello, my name is...'". (No lo obligues a ser un loro, hazlo pensar).

3. CORRECCIÓN ESTILO PRAKTIKA Y TOLERANCIA EXTREMA (¡CRÍTICO!)
   - EL ALUMNO USA EL MÓVIL. IGNORA POR COMPLETO la falta de mayúsculas, signos de interrogación/exclamación, puntos o comas. NUNCA los corrijas ni los menciones. Si dice "hello my name is raul" es 100% CORRECTO y perfecto.
   - SOLO corrige errores que afecten la comunicación, estructura gramatical severa o vocabulario totalmente erróneo (ej. si dice "I are raul").
   - Si se equivoca en algo importante: 1) Valida su intento. 2) Enséñale pacientemente la frase correcta palabra por palabra en español. 3) Pídele que lo intente de nuevo o avanza fluidamente si ya entendió. ¡No seas estricto!

4. FLUJO DE SESIÓN ESTRUCTURADO DURANTE LA PRÁCTICA
   - SOLO cuando estés dando o evaluando un ejercicio de roleplay, usa este formato exacto:
     
     [Feedback amigable y corrección (si hubo error grave) en ${user.idioma_nativo}]
     
     [Breve transición animada en ${user.idioma_nativo}]
     
     📝
     Ejercicio X/5. [Plantea el escenario de rol inmersivo y hazle la pregunta abierta en ${user.idioma_objetivo} y tradúcela al español para niveles iniciales].
     
   - Consignas originales a adaptar como rol abierto:
     ${levelCard.ejercicios.map(e => `     - [Ejercicio ${e.orden}]: ${e.instruccion}`).join('\n')}

5. EVITAR BUCLES Y SUBIR DE NIVEL RÁPIDAMENTE (¡OBLIGATORIO!)
   - Cada nivel consta de exactamente los 5 ejercicios que te he pasado. 
   - Apenas el alumno responda correctamente (o aceptablemente) el Ejercicio 5, DEBES poner \`"listo_para_subir_de_nivel": true\` en tu JSON de <eval>.
   - NUNCA lo dejes atrapado en un bucle si ya terminó los 5 ejercicios. Dile "¡Excelente! Has dominado esta situación." y márcalo listo para subir.

6. IDIOMA Y MOTIVACIÓN
   - Motiva con energía. Celebra sus respuestas. 
   - Usa ${user.idioma_nativo} para explicar y corregir. Usa ${user.idioma_objetivo} para el roleplay en sí.

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
