import { getChromaClient } from '../database/vector/chroma_client.js';

async function test() {
  console.log('🔌 Conectando a ChromaDB...');
  const client = getChromaClient();
  try {
    console.log('📡 Obteniendo colecciones...');
    const collections = await client.listCollections();
    console.log('✅ Colecciones obtenidas con éxito:', collections);
  } catch (err) {
    console.error('❌ Error de ChromaDB:', err.message);
  }
}

test();
