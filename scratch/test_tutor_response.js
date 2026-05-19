import OpenAI from 'openai';
import { settings } from '../config/settings.js';
import { getUser } from '../database/db.js';
import { getTutorResponseStream } from '../ai/tutor.js';

const openai = new OpenAI({ apiKey: settings.openai.apiKey });

async function simulate() {
  console.log('🔌 Conectando a la DB...');
  const user = await getUser(5311453661);
  console.log('✅ Usuario obtenido:', user.nombre, 'Nivel:', user.nivel_actual);

  const history = [
    { role: 'assistant', content: '¿Todo claro hasta aquí? ¿Listo para empezar a practicar?' },
    { role: 'user', content: 'Si' }
  ];

  console.log('🚀 Iniciando getTutorResponseStream...');
  try {
    const stream = await getTutorResponseStream(openai, user, history, 'Si');
    console.log('✅ Stream obtenido con éxito!');

    console.log('📖 Empezando a consumir el stream...');
    let rawResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      rawResponse += content;
      process.stdout.write(content);
    }
    console.log('\n\n✅ Stream finalizado!');
    console.log('📄 Respuesta completa:', rawResponse);
  } catch (err) {
    console.error('❌ Error durante la simulación:', err);
  }
  process.exit(0);
}

simulate();
