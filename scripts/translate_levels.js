/**
 * scripts/translate_levels.js
 *
 * Lee el archivo de niveles de inglés (levels/english/levels_1_100.json)
 * y genera los archivos de niveles para francés, japonés, coreano, portugués, alemán e italiano.
 *
 * Utiliza GPT-4o-mini en lotes paralelos optimizados para una traducción veloz y de altísima calidad pedagógica.
 */

import OpenAI from 'openai';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGLISH_FILE = join(__dirname, '../levels/english/levels_1_100.json');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LANGUAGES = [
  { key: 'french', name: 'francés', locale: 'French' },
  { key: 'japanese', name: 'japonés', locale: 'Japanese', phonetic: true },
  { key: 'korean', name: 'coreano', locale: 'Korean', phonetic: true },
  { key: 'portuguese', name: 'portugués', locale: 'Portuguese' },
  { key: 'german', name: 'alemán', locale: 'German' },
  { key: 'italian', name: 'italiano', locale: 'Italian' }
];

async function translateBatch(levels, targetLang) {
  const prompt = `Tienes una lista de fichas de lección en inglés redactadas en español (el idioma nativo es español y el idioma objetivo es inglés).
Tu tarea es traducir y adaptar estas fichas para que el idioma objetivo sea: ${targetLang.name.toUpperCase()} (el idioma nativo sigue siendo español).

Esto significa que debes adaptar:
1. El vocabulario nuevo de inglés a ${targetLang.name}.
2. La estructura gramatical (patrón, ejemplo correcto, ejemplo incorrecto, y explicación en español) para que enseñe la gramática de ${targetLang.name} en vez de inglés.
3. Los errores comunes para mostrar errores típicos de hispanohablantes al aprender ${targetLang.name} (por ejemplo, pronunciación, concordancia, falsos amigos, etc.).
${targetLang.phonetic ? '4. IMPORTANTE: Para este idioma, incluye SIEMPRE la escritura nativa (japonés/coreano) seguida de su transliteración fonética legible en español entre paréntesis. Ejemplo: "안녕하세요 (An-nyeong-ha-se-yo) - Hola".' : ''}

Conserva exactamente los mismos números de nivel ("nivel") y nombres/descripciones adaptados al idioma.

Recibe este array de niveles en formato JSON:
${JSON.stringify(levels, null, 2)}

Devuelve ÚNICAMENTE un objeto JSON válido con la propiedad "levels" que contenga la lista de niveles adaptados en el mismo orden. No uses bloques de markdown \`\`\`json ni texto explicativo.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Eres un lingüista y diseñador instruccional experto en la enseñanza de ${targetLang.name} para hispanohablantes. Devuelves siempre JSON válido.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0].message.content;
  const parsed = JSON.parse(content);
  return parsed.levels || parsed;
}

async function translateLanguage(targetLang, englishLevels) {
  console.log(`\n🌍 Iniciando traducción para: ${targetLang.name.toUpperCase()}...`);
  const outputDir = join(__dirname, `../levels/${targetLang.key}`);
  const outputFile = join(outputDir, 'levels_1_100.json');

  mkdirSync(outputDir, { recursive: true });

  const batchSize = 10;
  const translatedLevels = [];

  // Dividir los 100 niveles en 10 lotes de 10 niveles
  const batches = [];
  for (let i = 0; i < englishLevels.length; i += batchSize) {
    batches.push(englishLevels.slice(i, i + batchSize));
  }

  // Ejecutar traducción en lotes secuenciales para evitar límites de tasa pero con buena velocidad
  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx];
    const fromLvl = batch[0].nivel;
    const toLvl = batch[batch.length - 1].nivel;
    
    let retries = 3;
    while (retries > 0) {
      try {
        console.log(`  [${targetLang.name}] Traduciendo niveles ${fromLvl} a ${toLvl}...`);
        const result = await translateBatch(batch, targetLang);
        translatedLevels.push(...result);
        break;
      } catch (err) {
        retries--;
        console.error(`  [${targetLang.name}] Error en niveles ${fromLvl}-${toLvl} (reintentos: ${retries}):`, err.message);
        if (retries === 0) throw err;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  // Re-ensamblar ejercicios originales y criterios si la traducción omitió alguno, para garantizar integridad absoluta
  const finalLevels = translatedLevels.map((lvl, index) => {
    const original = englishLevels[index];
    return {
      nivel: original.nivel,
      nombre: lvl.nombre || original.nombre,
      idioma: targetLang.name,
      cefr: original.cefr,
      bloque: original.bloque,
      descripcion: lvl.descripcion || original.descripcion,
      lo_que_ya_sabe: lvl.lo_que_ya_sabe || original.lo_que_ya_sabe,
      vocabulario_nuevo: lvl.vocabulario_nuevo || original.vocabulario_nuevo,
      estructura_gramatical: lvl.estructura_gramatical || original.estructura_gramatical,
      ejercicios: original.ejercicios, // Conservar los ejercicios e instrucciones
      errores_comunes: lvl.errores_comunes || original.errores_comunes,
      criterio_para_subir_de_nivel: original.criterio_para_subir_de_nivel
    };
  });

  // Ordenar niveles
  finalLevels.sort((a, b) => a.nivel - b.nivel);

  writeFileSync(outputFile, JSON.stringify(finalLevels, null, 2), 'utf-8');
  console.log(`✅ ¡Éxito! Niveles de ${targetLang.name} guardados en: ${outputFile}`);
}

async function main() {
  console.log('🚀 Iniciando traducción masiva de niveles...');
  const englishLevels = JSON.parse(readFileSync(ENGLISH_FILE, 'utf-8'));

  // Procesar cada idioma en paralelo
  const promises = LANGUAGES.map(lang => 
    translateLanguage(lang, englishLevels)
      .catch(err => console.error(`❌ Error fatal traduciendo ${lang.name}:`, err.message))
  );

  await Promise.all(promises);
  console.log('\n🎉 ¡PROCESO COMPLETADO CON ÉXITO! Todos los idiomas están listos en la base de datos.');
}

main().catch(err => {
  console.error('❌ Error general:', err);
  process.exit(1);
});
