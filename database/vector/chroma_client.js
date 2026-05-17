import { CloudClient } from 'chromadb';
import OpenAI from 'openai';
import { settings } from '../../config/settings.js';

let clientInstance = null;
let embedderInstance = null;

/**
 * Retorna el cliente CloudClient de ChromaDB.
 */
export function getChromaClient() {
  if (!clientInstance) {
    clientInstance = new CloudClient({
      tenant: settings.chroma.tenant,
      database: settings.chroma.database,
      apiKey: settings.chroma.apiKey,
    });
  }
  return clientInstance;
}

/**
 * Retorna la función de embedding utilizando OpenAI (text-embedding-3-small).
 */
export function getOpenAIEmbedder() {
  if (!embedderInstance) {
    const openai = new OpenAI({ apiKey: settings.openai.apiKey });
    embedderInstance = {
      generate: async (texts) => {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts,
        });
        return response.data.map(d => d.embedding);
      },
    };
  }
  return embedderInstance;
}
