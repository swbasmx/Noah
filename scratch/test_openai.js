import OpenAI from 'openai';
import { settings } from '../config/settings.js';

const openai = new OpenAI({ apiKey: settings.openai.apiKey });

async function test() {
  console.log(`🤖 Usando modelo: ${settings.openai.model}`);
  console.log('📡 Enviando solicitud a OpenAI...');
  try {
    const stream = await openai.chat.completions.create({
      model: settings.openai.model,
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true
    });
    console.log('✅ Stream obtenido! Leyendo chunks...');
    for await (const chunk of stream) {
      process.stdout.write(chunk.choices[0]?.delta?.content || '');
    }
    console.log('\n✅ Completado con éxito!');
  } catch (err) {
    console.error('❌ Error de OpenAI:', err.message);
  }
}

test();
