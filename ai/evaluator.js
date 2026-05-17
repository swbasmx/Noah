/**
 * ai/evaluator.js
 *
 * Extrae y parsea el bloque JSON <eval>...</eval> que devuelve el tutor
 * al final de cada mensaje, separándolo del texto visible que se envía al usuario.
 */

/**
 * Parsea la respuesta del tutor para separar el mensaje visible de la evaluación.
 * @param {string} rawText — Respuesta cruda de OpenAI
 * @returns {{ visibleText: string, evaluation: object | null }}
 */
export function parseTutorResponse(rawText) {
  const evalRegex = /<eval>([\s\S]*?)<\/eval>/i;
  const match = rawText.match(evalRegex);

  let evaluation = null;
  let visibleText = rawText;

  if (match) {
    // Quitar el bloque <eval> del texto visible que verá el alumno
    visibleText = rawText.replace(evalRegex, '').trim();

    try {
      const jsonStr = match[1].trim();
      evaluation = JSON.parse(jsonStr);
    } catch (err) {
      console.error('⚠️ [Evaluator] Error parseando bloque <eval> JSON:', err.message);
      
      // Intento de recuperación amigable si hay comas adicionales o caracteres sueltos
      try {
        let clean = match[1].trim();
        // Quitar comentarios si existieran
        clean = clean.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
        evaluation = JSON.parse(clean);
      } catch (e) {
        console.error('❌ [Evaluator] No se pudo recuperar el JSON de evaluación.');
        evaluation = null;
      }
    }
  }

  return {
    visibleText,
    evaluation,
  };
}
