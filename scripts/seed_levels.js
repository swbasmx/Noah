/**
 * scripts/seed_levels.js
 *
 * Toma el archivo JSON de las 100 fichas de nivel y las indexa
 * en la colección niveles_inglés en ChromaDB Cloud.
 *
 * Uso:
 *   node scripts/seed_levels.js
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { getNivelesCollection } from '../database/vector/collections.js';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE_PATH = join(__dirname, '../levels/english/levels_1_100.json');

async function main() {
  console.log('🌱 Noah — Cargando fichas de nivel en ChromaDB...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let rawData;
  try {
    rawData = readFileSync(FILE_PATH, 'utf-8');
  } catch (err) {
    console.error('❌ No se encontró el archivo levels_1_100.json. ¿Ya corriste el script de generación?', err.message);
    process.exit(1);
  }

  const levels = JSON.parse(rawData);
  console.log(`📖 Se cargaron ${levels.length} fichas del JSON.`);

  const collection = await getNivelesCollection('inglés');

  console.log('⚙️ Subiendo fichas en lotes de 10...');
  
  const ids = [];
  const documents = [];
  const metadatas = [];

  for (const level of levels) {
    const docText = `Nivel ${level.nivel} - ${level.nombre}. CEFR: ${level.cefr}. Bloque: ${level.bloque}. Descripción: ${level.descripcion}. Vocabulario nuevo: ${level.vocabulario_nuevo.join(', ')}. Estructura Gramatical: ${level.estructura_gramatical.patron}. Ejemplos: Correcto: "${level.estructura_gramatical.ejemplo_correcto}" | Incorrecto: "${level.estructura_gramatical.ejemplo_incorrecto}". Explicación: ${level.estructura_gramatical.explicacion}`;

    ids.push(`nivel_${level.nivel}_ingles`);
    documents.push(docText);
    metadatas.push({
      nivel: level.nivel,
      nombre: level.nombre,
      cefr: level.cefr,
      bloque: level.bloque,
      idioma: level.idioma,
    });
  }

  // Subir en lotes de 10 para evitar sobrecargar la red o payload
  const batchSize = 10;
  for (let i = 0; i < ids.length; i += batchSize) {
    const end = Math.min(i + batchSize, ids.length);
    console.log(`🚀 Subiendo lote de nivel ${i + 1} a ${end}...`);
    
    await collection.add({
      ids: ids.slice(i, end),
      documents: documents.slice(i, end),
      metadatas: metadatas.slice(i, end),
    });
  }

  console.log('\n✅ ¡Fichas de nivel cargadas exitosamente en ChromaDB!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('❌ Error cargando fichas:', err);
  process.exit(1);
});
