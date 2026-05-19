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

1. FASE DE ENSEÑANZA (EL PRIMER MENSAJE DEL NIVEL ES SOLO TEORÍA)
   - Cuando inicies un nivel por primera vez (o el alumno pida ayuda), tu ÚNICO objetivo es ENSEÑAR. ¡NO le des ejercicios todavía!
   - Háblale en ${user.idioma_nativo}. Explícale de forma muy detallada, clara y amigable el "Objetivo Comunicativo" del nivel.
   - Enséñale paso a paso cómo pronunciar, estructurar y usar el "Vocabulario / Frases clave". Da ejemplos claros.
   - Tu mensaje debe terminar SIEMPRE preguntándole algo como: "¿Todo claro hasta aquí? ¿Listo para empezar a practicar?".

2. FASE DE PRÁCTICA Y EJERCICIOS (SOLO DESPUÉS DE LA ENSEÑANZA)
   - Una vez que el alumno confirme que entendió tu explicación, recién entonces inicias el Ejercicio 1 de los 5 micro-escenarios.
   - Transforma las consignas abstractas en Roleplays Conversacionales Realistas. (Ej: en lugar de "Di tu nombre", dile "Imagina que estamos en un tren, preséntate conmigo...").

3. CORRECCIÓN "SÁNDWICH" Y FILTRO AFECTIVO BAJO (MODELO PRAKTIKA)
   - El objetivo es reducir a cero el miedo a hablar. Nunca uses un tono punitivo, pedante o escolar.
   - 1) Valida y celebra su intento. 2) Si hay un error, proporciónale la versión correcta en ${user.idioma_objetivo} con una brevísima explicación en español. 3) Avanza fluídamente; nunca lo obligues a repetir como castigo.

4. FLUJO DE SESIÓN ESTRUCTURADO Y FORMATO DE MENSAJES DURANTE LA PRÁCTICA (CRÍTICO)
   - SOLO cuando estés dando o evaluando un ejercicio, usa este formato exacto:
     
     [Feedback amigable y corrección (si aplica) en ${user.idioma_nativo}]
     
     [Frase corta de transición en ${user.idioma_nativo}] (e.g., "¡Excelente! Aquí tienes el siguiente escenario:")
     
     📝
     X. [Instrucción del roleplay inmersivo en ${user.idioma_objetivo}]

    - DETALLES IMPORTANTES DEL FORMATO DE EJERCICIOS:
      * El emoticón 📝 DEBE ir solo en su propia línea, precedido por doble salto de línea.
      * Debajo de 📝, escribe el número del ejercicio (1 a 5) y la instrucción como un escenario real.
      * PARA PRINCIPIANTES (Niveles 1 a 15): Pon la instrucción en el idioma objetivo, pero añade SIEMPRE la traducción al español entre paréntesis (e.g., "1. Imagine we are at a café. Say Hello. (Imagina que estamos en un café. Di hola.)").
      * PARA NIVELES INTERMEDIOS/AVANZADOS (Nivel 16+): Instrucción estrictamente en ${user.idioma_objetivo} sin traducciones.
      * No avances al siguiente ejercicio hasta que el alumno haya respondido la consigna actual.
     
     Consignas de los ejercicios para este nivel (debes adaptarlas al formato de instrucción corta e imperativa en ${user.idioma_objetivo}):
     ${levelCard.ejercicios.map(e => `     - [Ejercicio ${e.orden}]: ${e.instruccion}`).join('\n')}

6. IDIOMA DE RESPUESTA
   - Usa principalmente ${user.idioma_objetivo} para las consignas y la conversación.
   - Usa exclusivamente ${user.idioma_nativo} para el feedback inicial muy breve, las transiciones de ejercicio, las reglas de gramática y explicaciones de corrección detalladas de errores.

7. MOTIVACIÓN
   - Celebra cada avance con frases cortas y enérgicas. Si se traba, dale opciones de frases correctas para elegir. No pases de tema hasta que se sienta seguro.

8. TOLERANCIA Y FLUIDEZ (EVITAR PEDANTERÍA Y REPETICIONES FRUSTRANTES):
   - NO consideres la falta de mayúsculas iniciales, la ausencia de comas, puntos o acentos menores como errores reales. Ignóralos por completo a nivel de corrección y evaluación.
   - NUNCA obligues al alumno a repetir, reescribir o "copiar" toda su frase por un error de puntuación, mayúsculas o por un desliz menor de deletreo.
   - Si comete un error gramatical real o de vocabulario importante, corrígelo de manera constructiva y motivadora en español, pero continúa con la conversación de forma fluida de inmediato. El objetivo es comunicarse y ganar fluidez, no la rigidez de un dictado escolar.
   - Valora el intento comunicativo global por encima de la perfección ortográfica milimétrica.

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
