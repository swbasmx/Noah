import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = join(__dirname, '../../bot_tutor.db');

let db;

/**
 * Abre la conexión y crea las tablas si no existen.
 */
export function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Mejor rendimiento concurrente

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id_telegram     INTEGER PRIMARY KEY,
      nombre          TEXT,
      idioma_nativo   TEXT,
      idioma_objetivo TEXT,
      nivel_actual    INTEGER DEFAULT 1,
      fecha_registro  DATETIME DEFAULT CURRENT_TIMESTAMP,
      ultima_sesion   DATETIME DEFAULT CURRENT_TIMESTAMP,
      racha_dias      INTEGER DEFAULT 0,
      estado          TEXT DEFAULT 'onboarding'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario             INTEGER,
      fecha_inicio           DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_fin              DATETIME,
      mensajes_totales       INTEGER DEFAULT 0,
      errores_sesion         TEXT DEFAULT '[]',
      palabras_nuevas_usadas TEXT DEFAULT '[]',
      subio_de_nivel         BOOLEAN DEFAULT 0,
      listo_para_subir       INTEGER DEFAULT 0,
      FOREIGN KEY (id_usuario) REFERENCES users(id_telegram)
    );

    CREATE TABLE IF NOT EXISTS errors (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario            INTEGER,
      error_texto           TEXT,
      correccion            TEXT,
      tipo_error            TEXT,
      tema                  TEXT,
      nivel_cuando_ocurrio  INTEGER,
      veces_repetido        INTEGER DEFAULT 1,
      fecha                 DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_usuario) REFERENCES users(id_telegram)
    );

    CREATE TABLE IF NOT EXISTS progress (
      id_usuario                  INTEGER PRIMARY KEY,
      palabras_totales_aprendidas INTEGER DEFAULT 0,
      sesiones_totales            INTEGER DEFAULT 0,
      tiempo_total_minutos        INTEGER DEFAULT 0,
      nivel_maximo_alcanzado      INTEGER DEFAULT 1,
      FOREIGN KEY (id_usuario) REFERENCES users(id_telegram)
    );
  `);

  console.log('✅ Base de datos SQLite inicializada');
  return db;
}

/**
 * Retorna la instancia de la base de datos (ya inicializada).
 */
export function getDB() {
  if (!db) throw new Error('DB no inicializada. Llama a initDB() primero.');
  return db;
}
