import { getDB } from './models.js';

// ─── USUARIOS ────────────────────────────────────────────────────────────────

export function getUser(idTelegram) {
  return getDB().prepare(`SELECT * FROM users WHERE id_telegram = ?`).get(idTelegram);
}

export function createUser(idTelegram, nombre) {
  getDB().prepare(`
    INSERT OR IGNORE INTO users (id_telegram, nombre)
    VALUES (?, ?)
  `).run(idTelegram, nombre);
  return getUser(idTelegram);
}

export function updateUser(idTelegram, fields) {
  const keys   = Object.keys(fields);
  const setClauses = keys.map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(fields), idTelegram];
  getDB().prepare(`UPDATE users SET ${setClauses} WHERE id_telegram = ?`).run(...values);
}

export function setUserState(idTelegram, estado) {
  updateUser(idTelegram, { estado });
}

export function touchSession(idTelegram) {
  const user = getUser(idTelegram);
  if (!user) return;

  const today     = new Date().toISOString().slice(0, 10);
  const lastSession = user.ultima_sesion ? user.ultima_sesion.slice(0, 10) : null;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  let racha = user.racha_dias || 0;
  if (lastSession === yesterday) {
    racha += 1;
  } else if (lastSession !== today) {
    racha = 1;
  }

  updateUser(idTelegram, {
    ultima_sesion: new Date().toISOString(),
    racha_dias: racha,
  });
}

// ─── SESIONES ────────────────────────────────────────────────────────────────

export function openSession(idUsuario) {
  const info = getDB().prepare(`
    INSERT INTO sessions (id_usuario) VALUES (?)
  `).run(idUsuario);
  return info.lastInsertRowid;
}

export function closeSession(sessionId, extras = {}) {
  getDB().prepare(`
    UPDATE sessions
    SET fecha_fin          = CURRENT_TIMESTAMP,
        mensajes_totales   = ?,
        errores_sesion     = ?,
        palabras_nuevas_usadas = ?,
        subio_de_nivel     = ?,
        listo_para_subir   = ?
    WHERE id = ?
  `).run(
    extras.mensajes_totales   ?? 0,
    JSON.stringify(extras.errores_sesion       ?? []),
    JSON.stringify(extras.palabras_nuevas_usadas ?? []),
    extras.subio_de_nivel     ? 1 : 0,
    extras.listo_para_subir   ? 1 : 0,
    sessionId,
  );
}

export function updateSession(sessionId, extras = {}) {
  getDB().prepare(`
    UPDATE sessions
    SET mensajes_totales   = ?,
        errores_sesion     = ?,
        palabras_nuevas_usadas = ?,
        listo_para_subir   = ?
    WHERE id = ?
  `).run(
    extras.mensajes_totales   ?? 0,
    JSON.stringify(extras.errores_sesion       ?? []),
    JSON.stringify(extras.palabras_nuevas_usadas ?? []),
    extras.listo_para_subir   ? 1 : 0,
    sessionId,
  );
}

export function getLastNSessions(idUsuario, n = 2) {
  return getDB().prepare(`
    SELECT * FROM sessions
    WHERE id_usuario = ?
    ORDER BY fecha_inicio DESC
    LIMIT ?
  `).all(idUsuario, n);
}

// ─── ERRORES ─────────────────────────────────────────────────────────────────

export function saveError(idUsuario, { error_texto, correccion, tipo_error, tema, nivel }) {
  const db = getDB();
  const existing = db.prepare(`
    SELECT id, veces_repetido FROM errors
    WHERE id_usuario = ? AND error_texto = ?
  `).get(idUsuario, error_texto);

  if (existing) {
    db.prepare(`
      UPDATE errors SET veces_repetido = ?, fecha = CURRENT_TIMESTAMP WHERE id = ?
    `).run(existing.veces_repetido + 1, existing.id);
  } else {
    db.prepare(`
      INSERT INTO errors (id_usuario, error_texto, correccion, tipo_error, tema, nivel_cuando_ocurrio)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(idUsuario, error_texto, correccion, tipo_error, tema, nivel);
  }
}

export function getTopErrors(idUsuario, limit = 3) {
  return getDB().prepare(`
    SELECT * FROM errors
    WHERE id_usuario = ?
    ORDER BY veces_repetido DESC, fecha DESC
    LIMIT ?
  `).all(idUsuario, limit);
}

// ─── PROGRESO ────────────────────────────────────────────────────────────────

export function initProgress(idUsuario) {
  getDB().prepare(`
    INSERT OR IGNORE INTO progress (id_usuario) VALUES (?)
  `).run(idUsuario);
}

export function getProgress(idUsuario) {
  return getDB().prepare(`SELECT * FROM progress WHERE id_usuario = ?`).get(idUsuario);
}

export function incrementProgress(idUsuario, { palabras = 0, sesiones = 0, minutos = 0 } = {}) {
  getDB().prepare(`
    UPDATE progress
    SET palabras_totales_aprendidas = palabras_totales_aprendidas + ?,
        sesiones_totales            = sesiones_totales + ?,
        tiempo_total_minutos        = tiempo_total_minutos + ?
    WHERE id_usuario = ?
  `).run(palabras, sesiones, minutos, idUsuario);
}

export function updateMaxLevel(idUsuario, nivel) {
  getDB().prepare(`
    UPDATE progress
    SET nivel_maximo_alcanzado = MAX(nivel_maximo_alcanzado, ?)
    WHERE id_usuario = ?
  `).run(nivel, idUsuario);
}

// ─── LEVEL UP ────────────────────────────────────────────────────────────────

/**
 * Revisa si las últimas N sesiones tienen listo_para_subir = 1.
 * Si sí, sube el nivel y retorna true.
 */
export function checkAndLevelUp(idUsuario, sessionsRequired = 2) {
  const recent = getLastNSessions(idUsuario, sessionsRequired);
  if (recent.length < sessionsRequired) return false;

  const allReady = recent.every(s => s.listo_para_subir === 1);
  if (!allReady) return false;

  const user = getUser(idUsuario);
  const newLevel = (user.nivel_actual || 1) + 1;
  if (newLevel > 100) return false;

  updateUser(idUsuario, { nivel_actual: newLevel });
  updateMaxLevel(idUsuario, newLevel);
  return newLevel;
}

export function getActiveSession(idUsuario) {
  return getDB().prepare(`SELECT * FROM sessions WHERE id_usuario = ? AND fecha_fin IS NULL LIMIT 1`).get(idUsuario);
}
