import { config } from 'dotenv';
config();

const isMongo = !!process.env.MONGODB_URI;

let queries = null;

if (isMongo) {
  try {
    const { connectMongo } = await import('./mongo/client.js');
    await connectMongo();
    queries = await import('./mongo/queries.js');
  } catch (err) {
    console.error('❌ Fallo al inicializar MongoDB Atlas. Usando SQLite de respaldo...', err.message);
    const { initDB } = await import('./sql/models.js');
    initDB();
    queries = await import('./sql/queries.js');
  }
} else {
  const { initDB } = await import('./sql/models.js');
  initDB();
  queries = await import('./sql/queries.js');
}

export const {
  getUser,
  createUser,
  updateUser,
  setUserState,
  touchSession,
  openSession,
  closeSession,
  updateSession,
  getLastNSessions,
  saveError,
  getTopErrors,
  initProgress,
  getProgress,
  incrementProgress,
  updateMaxLevel,
  checkAndLevelUp,
  getActiveSession
} = queries;

export function isMongoDBActive() {
  return isMongo;
}
