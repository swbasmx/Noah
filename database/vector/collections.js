import { getChromaClient, getOpenAIEmbedder } from './chroma_client.js';

function sanitizeCollectionName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // elimina acentos y diacríticos
    .replace(/[^a-z0-9._-]/g, "_"); // reemplaza caracteres no válidos con guión bajo
}

// ─── COLECCIONES BÁSICAS ─────────────────────────────────────────────────────

/**
 * Obtiene o crea la colección de fichas de nivel para un idioma dado.
 */
export async function getNivelesCollection(idioma = 'inglés') {
  const client   = getChromaClient();
  const embedder = getOpenAIEmbedder();
  return await client.getOrCreateCollection({
    name: sanitizeCollectionName(`niveles_${idioma}`),
    embeddingFunction: embedder,
  });
}

/**
 * Obtiene o crea la colección de historial para un usuario.
 */
export async function getHistorialCollection(userId) {
  const client   = getChromaClient();
  const embedder = getOpenAIEmbedder();
  return await client.getOrCreateCollection({
    name: `historial_${userId}`,
    embeddingFunction: embedder,
  });
}

/**
 * Obtiene o crea la colección de errores para un usuario.
 */
export async function getErroresCollection(userId) {
  const client   = getChromaClient();
  const embedder = getOpenAIEmbedder();
  return await client.getOrCreateCollection({
    name: `errores_${userId}`,
    embeddingFunction: embedder,
  });
}

// ─── ACCIONES VECTORIALES ─────────────────────────────────────────────────────

/**
 * Guarda un par mensaje/respuesta en el historial vectorial.
 */
export async function saveConversationTurn(userId, userMsg, botMsg, nivel) {
  try {
    const col = await getHistorialCollection(userId);
    const id  = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const doc = `El alumno dijo: ${userMsg}. El tutor respondió: ${botMsg}`;

    await col.add({
      ids: [id],
      documents: [doc],
      metadatas: [{
        id_usuario: userId,
        fecha: new Date().toISOString(),
        nivel: parseInt(nivel) || 1,
      }],
    });
  } catch (err) {
    console.error(`[ChromaDB] Error guardando turno del usuario ${userId}:`, err.message);
  }
}

/**
 * Guarda o actualiza un error semántico detectado en ChromaDB.
 */
export async function saveErrorToVector(userId, { error, correccion, tipo, tema, nivel }) {
  try {
    const col = await getErroresCollection(userId);
    const id  = `err_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const doc = `Error detectado: "${error}". Corrección recomendada: "${correccion}". Tipo de error: ${tipo}. Tema gramatical: ${tema}.`;

    await col.add({
      ids: [id],
      documents: [doc],
      metadatas: [{
        id_usuario: userId,
        tipo,
        tema,
        nivel: parseInt(nivel) || 1,
      }],
    });
  } catch (err) {
    console.error(`[ChromaDB] Error guardando error vectorial del usuario ${userId}:`, err.message);
  }
}

/**
 * Busca fragmentos del historial de conversación similares al mensaje actual.
 */
export async function getRelevantHistory(userId, currentMessage, n = 3) {
  try {
    const col = await getHistorialCollection(userId);
    const results = await col.query({
      queryTexts: [currentMessage],
      nResults: n,
    });
    if (results && results.documents && results.documents.length > 0) {
      return results.documents[0];
    }
  } catch (err) {
    console.warn(`[ChromaDB] No se pudo consultar el historial para ${userId}:`, err.message);
  }
  return [];
}

/**
 * Busca errores pasados que el usuario cometió que sean semánticamente similares a la estructura del mensaje actual.
 */
export async function getRelevantErrors(userId, currentMessage, n = 3) {
  try {
    const col = await getErroresCollection(userId);
    const results = await col.query({
      queryTexts: [currentMessage],
      nResults: n,
    });
    if (results && results.documents && results.documents.length > 0) {
      return results.documents[0];
    }
  } catch (err) {
    console.warn(`[ChromaDB] No se pudo consultar los errores para ${userId}:`, err.message);
  }
  return [];
}
