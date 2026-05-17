import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

const uri = process.env.MONGODB_URI;
let client = null;
let db = null;

export async function connectMongo() {
  if (db) return db;
  if (!uri) {
    throw new Error('❌ MONGODB_URI no está definido en las variables de entorno.');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db('noah_tutor');
  console.log('🔌 Conectado exitosamente a MongoDB Atlas');
  return db;
}

export function getMongoDb() {
  if (!db) {
    throw new Error('MongoDB no inicializado. Llama a connectMongo() primero.');
  }
  return db;
}
