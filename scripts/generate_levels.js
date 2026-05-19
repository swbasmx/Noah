/**
 * scripts/generate_levels.js
 *
 * Llama a gpt-4o-mini (barato + inteligente) en 20 lotes de 5 niveles cada uno
 * y guarda el resultado en levels/english/levels_1_100.json.
 *
 * Uso:
 *   node scripts/generate_levels.js
 */

import OpenAI from 'openai';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR  = join(__dirname, '../levels/english');
const OUTPUT_FILE = join(OUTPUT_DIR, 'levels_1_100.json');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Configuración de lotes de 5 niveles (más pequeños y estables) ─────────────
const BATCHES = [];
for (let i = 1; i <= 100; i += 5) {
  const from = i;
  const to = Math.min(i + 4, 100);
  let cefr = 'A1';
  let bloque = 'supervivencia';
  
  if (from >= 1 && to <= 15) {
    cefr = 'A1';
    bloque = 'supervivencia';
  } else if (from >= 16 && to <= 30) {
    cefr = 'A1-A2';
    bloque = 'vida_cotidiana';
  } else if (from >= 31 && to <= 50) {
    cefr = 'A2-B1';
    bloque = 'comunicacion_real';
  } else if (from >= 51 && to <= 70) {
    cefr = 'B1-B2';
    bloque = 'fluidez';
  } else if (from >= 71 && to <= 85) {
    cefr = 'B2-C1';
    bloque = 'precision';
  } else {
    cefr = 'C1-C2';
    bloque = 'maestria';
  }
  
  BATCHES.push({ from, to, cefr, bloque });
}

// ─── Prompt base ─────────────────────────────────────────────────────────────
function buildPrompt(from, to, cefrHint, bloqueHint) {
  return `Genera exactamente ${to - from + 1} fichas de nivel para aprender inglés.
Los niveles van del ${from} al ${to}.
En este rango el CEFR es aproximadamente: ${cefrHint}
El bloque temático es: ${bloqueHint}

Devuelve ÚNICAMENTE un objeto JSON válido con la estructura { "levels": [...] } que contenga exactamente los ${to - from + 1} objetos de nivel.
No incluyas explicaciones, markdown ni texto fuera del JSON.

Cada objeto de nivel dentro del array "levels" debe tener EXACTAMENTE esta estructura:
{
  "nivel": <número del ${from} al ${to}>,
  "nombre": "<nombre descriptivo del tema>",
  "idioma": "inglés",
  "cefr": "${cefrHint}",
  "bloque": "${bloqueHint}",
  "descripcion": "<una oración con el objetivo del nivel>",
  "lo_que_ya_sabe": ["<conocimiento previo 1>", "<conocimiento previo 2>"],
  "vocabulario_funcional": ["<frase_o_palabra1>", "<frase_o_palabra2>", "<frase_o_palabra3>", "<frase_o_palabra4>", "<frase_o_palabra5>"],
  "enfoque_conversacional": {
    "objetivo_comunicativo": "<Qué logrará hacer el alumno en la vida real, ej. Pedir un café, Ligar en un bar>",
    "explicacion_amigable": "<explicación brevísima y amigable de la gramática/vocabulario necesario>"
  },
  "ejercicios": [
    {"orden": 1, "tipo": "roleplay_inicio", "instruccion": "<Micro-escenario inmersivo 1. Ej: 'Imagina que acabas de entrar a mi cafetería en Londres. Salúdame y pídeme el menú.'>"},
    {"orden": 2, "tipo": "roleplay_desarrollo", "instruccion": "<Micro-escenario 2. Ej: 'Dime que no tomas lácteos y pregúntame si tengo leche de avena.'>"},
    {"orden": 3, "tipo": "roleplay_pregunta", "instruccion": "<Micro-escenario 3. Ej: 'Pregúntame cuánto cuesta todo.'>"},
    {"orden": 4, "tipo": "roleplay_conflicto", "instruccion": "<Micro-escenario 4. Ej: 'Te digo que tu tarjeta fue rechazada. Pregúntame si puedes pagar en efectivo.'>"},
    {"orden": 5, "tipo": "roleplay_cierre", "instruccion": "<Micro-escenario 5. Ej: 'Despídete cordialmente y deséame un buen día.'>"}
  ],
  "errores_comunes": [
    {"error": "<error típico hispanohablante>", "correccion": "<versión correcta>", "explicacion_para_alumno": "<por qué>"}
  ],
  "criterio_para_subir_de_nivel": {
    "palabras_minimas_usadas": 4,
    "frases_completas_sin_ayuda": 3,
    "sesiones_minimas_en_nivel": 2,
    "porcentaje_errores_maximo": 30
  }
}

Reglas IMPORTANTES (MODELO PRAKTIKA - TASK-BASED LEARNING):
- NUNCA uses instrucciones escolares como "Completa la oración", "Di tu nombre", o "Imagina una tarjeta".
- TODOS los ejercicios deben ser micro-escenarios inmersivos encadenados (Roleplays reales y emocionantes de la vida cotidiana).
- El tutor (IA) y el alumno deben jugar un rol (ej. Mesero y Cliente, Entrevistador y Candidato, Dos desconocidos en un tren, Agente de aduanas).
- Cada nivel construye un hilo conversacional coherente de principio a fin (Ejercicio 1 empieza la interacción, Ejercicio 5 la despide).
- Vocabulario enfocado en 'lexical chunks' (frases funcionales útiles) en lugar de palabras aisladas.
- Devuelve SOLO el JSON, sin formato markdown (\`\`\`json ... \`\`\`), solo el objeto de respuesta directo.`;
}

// ─── Llamada a la API ─────────────────────────────────────────────────────────
async function generateBatch(batch) {
  console.log(`\n📦 Generando niveles ${batch.from}–${batch.to} (${batch.cefr})...`);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Eres un experto en lingüística aplicada y diseño instruccional. ' +
          'Generas fichas de nivel pedagógicamente correctas para enseñar inglés. ' +
          'Siempre devuelves un objeto JSON con la propiedad "levels" que contiene la lista de niveles.',
      },
      {
        role: 'user',
        content: buildPrompt(batch.from, batch.to, batch.cefr, batch.bloque),
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },  // Fuerza JSON puro
  });

  const raw = response.choices[0].message.content;
  let parsed = JSON.parse(raw);
  
  if (parsed.levels && Array.isArray(parsed.levels)) {
    return parsed.levels;
  }
  if (Array.isArray(parsed)) return parsed;

  const arr = Object.values(parsed).find(v => Array.isArray(v));
  if (arr) return arr;

  throw new Error(`Respuesta inesperada del lote ${batch.from}–${batch.to}: ${raw.slice(0, 200)}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 Noah — Generador de fichas de nivel');
  console.log('Modelo: gpt-4o-mini | Lotes: 20 × 5 niveles');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const allLevels = [];

  for (const batch of BATCHES) {
    let retries = 3;
    while (retries > 0) {
      try {
        const levels = await generateBatch(batch);

        const expected = batch.to - batch.from + 1;
        if (levels.length !== expected) {
          console.warn(
            `⚠️  Lote ${batch.from}–${batch.to}: se esperaban ${expected} niveles, llegaron ${levels.length}`
          );
        }

        allLevels.push(...levels);
        console.log(`✅ Niveles ${batch.from}–${batch.to} generados (${levels.length} fichas)`);
        break; // Éxito, salir del loop de reintentos
      } catch (err) {
        retries--;
        console.error(`❌ Error en lote ${batch.from}–${batch.to} (Reintentos restantes: ${retries}):`, err.message);
        if (retries === 0) {
          process.exit(1);
        }
        console.log('⏳ Esperando 5s antes de reintentar...');
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    // Pequeña pausa entre lotes para no saturar la API
    if (batch.to < 100) {
      process.stdout.write('⏳ Esperando 2s antes del siguiente lote...');
      await new Promise(r => setTimeout(r, 2000));
      console.log(' listo.');
    }
  }

  // Ordenar por número de nivel
  allLevels.sort((a, b) => a.nivel - b.nivel);

  // Validación final
  console.log(`\n📊 Total de fichas generadas: ${allLevels.length}/100`);
  const missing = [];
  for (let i = 1; i <= 100; i++) {
    if (!allLevels.find(l => l.nivel === i)) missing.push(i);
  }
  if (missing.length) {
    console.warn(`⚠️  Niveles faltantes: ${missing.join(', ')}`);
  }

  // Guardar archivo
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(allLevels, null, 2), 'utf-8');

  console.log(`\n✅ Archivo guardado en: ${OUTPUT_FILE}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Siguiente paso: node scripts/seed_levels.js  (carga en ChromaDB)');
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
