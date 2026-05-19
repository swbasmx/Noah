import { getUser, touchSession } from '../database/db.js';

async function test() {
  console.log('🔌 Conectando a MongoDB Atlas...');
  try {
    const userId = 5311453661; // El ID de Telegram que se ve en la base de datos
    console.log(`📡 Buscando usuario: ${userId}...`);
    const user = await getUser(userId);
    console.log('✅ Usuario encontrado:', user);
    
    if (user) {
      console.log('📡 Actualizando sesión (touchSession)...');
      await touchSession(userId);
      console.log('✅ touchSession completado con éxito!');
    } else {
      console.log('⚠️ El usuario de prueba no existe en la DB.');
    }
  } catch (err) {
    console.error('❌ Error de MongoDB:', err.message);
  }
  process.exit(0);
}

test();
