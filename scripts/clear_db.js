import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI no configurado en el archivo .env');
  process.exit(1);
}

async function run() {
  console.log('🔌 Conectando a MongoDB Atlas...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    console.log(`✅ Conectado a la base de datos: "${db.databaseName}"`);

    const collections = ['users', 'sessions', 'errors', 'progress'];

    for (const colName of collections) {
      const col = db.collection(colName);
      const count = await col.countDocuments();
      if (count > 0) {
        console.log(`🧹 Eliminando ${count} documento(s) de la colección: "${colName}"...`);
        await col.deleteMany({});
        console.log(`✅ Colección "${colName}" limpiada con éxito.`);
      } else {
        console.log(`ℹ️ La colección "${colName}" ya estaba vacía.`);
      }
    }

    console.log('\n🌟 ¡Base de datos MongoDB Atlas limpiada por completo con éxito! listo para comenzar limpio.');
  } catch (err) {
    console.error('❌ Error al limpiar la base de datos:', err);
  } finally {
    await client.close();
    process.exit(0);
  }
}

run();
