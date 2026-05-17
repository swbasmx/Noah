import { getMongoDb } from './client.js';
import { ObjectId } from 'mongodb';

// ─── AUXILIARES ──────────────────────────────────────────────────────────────

function getUsersCol() {
  return getMongoDb().collection('users');
}

function getSessionsCol() {
  return getMongoDb().collection('sessions');
}

function getErrorsCol() {
  return getMongoDb().collection('errors');
}

function getProgressCol() {
  return getMongoDb().collection('progress');
}

// ─── USUARIOS ────────────────────────────────────────────────────────────────

export async function getUser(idTelegram) {
  return await getUsersCol().findOne({ id_telegram: Number(idTelegram) });
}

export async function createUser(idTelegram, nombre) {
  const existing = await getUser(idTelegram);
  if (existing) return existing;

  const newUser = {
    id_telegram: Number(idTelegram),
    nombre,
    idioma_nativo: null,
    idioma_objetivo: null,
    nivel_actual: 1,
    fecha_registro: new Date(),
    ultima_sesion: new Date(),
    racha_dias: 0,
    estado: 'onboarding'
  };

  await getUsersCol().insertOne(newUser);
  return newUser;
}

export async function updateUser(idTelegram, fields) {
  await getUsersCol().updateOne(
    { id_telegram: Number(idTelegram) },
    { $set: fields }
  );
}

export async function setUserState(idTelegram, estado) {
  await updateUser(idTelegram, { estado });
}

export async function touchSession(idTelegram) {
  const user = await getUser(idTelegram);
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10);
  const lastSession = user.ultima_sesion ? new Date(user.ultima_sesion).toISOString().slice(0, 10) : null;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  let racha = user.racha_dias || 0;
  if (lastSession === yesterday) {
    racha += 1;
  } else if (lastSession !== today) {
    racha = 1;
  }

  await updateUser(idTelegram, {
    ultima_sesion: new Date(),
    racha_dias: racha,
  });
}

// ─── SESIONES ────────────────────────────────────────────────────────────────

export async function openSession(idUsuario) {
  const newSession = {
    id_usuario: Number(idUsuario),
    fecha_inicio: new Date(),
    fecha_fin: null,
    mensajes_totales: 0,
    errores_sesion: [],
    palabras_nuevas_usadas: [],
    subio_de_nivel: false,
    listo_para_subir: 0
  };

  const res = await getSessionsCol().insertOne(newSession);
  return res.insertedId.toString();
}

export async function closeSession(sessionId, extras = {}) {
  let queryId;
  try {
    queryId = new ObjectId(sessionId);
  } catch (err) {
    queryId = sessionId; // Fallback por si acaso es un entero de SQLite anterior
  }

  await getSessionsCol().updateOne(
    { _id: queryId },
    {
      $set: {
        fecha_fin: new Date(),
        mensajes_totales: extras.mensajes_totales ?? 0,
        errores_sesion: extras.errores_sesion ?? [],
        palabras_nuevas_usadas: extras.palabras_nuevas_usadas ?? [],
        subio_de_nivel: extras.subio_de_nivel ? true : false,
        listo_para_subir: extras.listo_para_subir ? 1 : 0
      }
    }
  );
}

export async function updateSession(sessionId, extras = {}) {
  let queryId;
  try {
    queryId = new ObjectId(sessionId);
  } catch (err) {
    queryId = sessionId;
  }

  await getSessionsCol().updateOne(
    { _id: queryId },
    {
      $set: {
        mensajes_totales: extras.mensajes_totales ?? 0,
        errores_sesion: extras.errores_sesion ?? [],
        palabras_nuevas_usadas: extras.palabras_nuevas_usadas ?? [],
        listo_para_subir: extras.listo_para_subir ? 1 : 0
      }
    }
  );
}

export async function getLastNSessions(idUsuario, n = 2) {
  const docs = await getSessionsCol()
    .find({ id_usuario: Number(idUsuario) })
    .sort({ fecha_inicio: -1 })
    .limit(n)
    .toArray();
  return docs.map(s => ({ ...s, id: s._id.toString() }));
}

// ─── ERRORES ─────────────────────────────────────────────────────────────────

export async function saveError(idUsuario, { error_texto, correccion, tipo_error, tema, nivel }) {
  const col = getErrorsCol();
  const existing = await col.findOne({ id_usuario: Number(idUsuario), error_texto });

  if (existing) {
    await col.updateOne(
      { _id: existing._id },
      {
        $set: { fecha: new Date() },
        $inc: { veces_repetido: 1 }
      }
    );
  } else {
    await col.insertOne({
      id_usuario: Number(idUsuario),
      error_texto,
      correccion,
      tipo_error,
      tema,
      nivel_cuando_ocurrio: nivel,
      veces_repetido: 1,
      fecha: new Date()
    });
  }
}

export async function getTopErrors(idUsuario, limit = 3) {
  return await getErrorsCol()
    .find({ id_usuario: Number(idUsuario) })
    .sort({ veces_repetido: -1, fecha: -1 })
    .limit(limit)
    .toArray();
}

// ─── PROGRESO ────────────────────────────────────────────────────────────────

export async function initProgress(idUsuario) {
  const col = getProgressCol();
  const existing = await col.findOne({ id_usuario: Number(idUsuario) });
  if (existing) return;

  await col.insertOne({
    id_usuario: Number(idUsuario),
    palabras_totales_aprendidas: 0,
    sesiones_totales: 0,
    tiempo_total_minutos: 0,
    nivel_maximo_alcanzado: 1
  });
}

export async function getProgress(idUsuario) {
  return await getProgressCol().findOne({ id_usuario: Number(idUsuario) });
}

export async function incrementProgress(idUsuario, { palabras = 0, sesiones = 0, minutos = 0 } = {}) {
  await getProgressCol().updateOne(
    { id_usuario: Number(idUsuario) },
    {
      $inc: {
        palabras_totales_aprendidas: palabras,
        sesiones_totales: sesiones,
        tiempo_total_minutos: minutos
      }
    }
  );
}

export async function updateMaxLevel(idUsuario, nivel) {
  const progress = await getProgress(idUsuario);
  if (!progress) return;

  const newMax = Math.max(progress.nivel_maximo_alcanzado || 1, nivel);
  await getProgressCol().updateOne(
    { id_usuario: Number(idUsuario) },
    { $set: { nivel_maximo_alcanzado: newMax } }
  );
}

// ─── LEVEL UP ────────────────────────────────────────────────────────────────

export async function checkAndLevelUp(idUsuario, sessionsRequired = 2) {
  const recent = await getLastNSessions(idUsuario, sessionsRequired);
  if (recent.length < sessionsRequired) return false;

  const allReady = recent.every(s => s.listo_para_subir === 1);
  if (!allReady) return false;

  const user = await getUser(idUsuario);
  const newLevel = (user.nivel_actual || 1) + 1;
  if (newLevel > 100) return false;

  await updateUser(idUsuario, { nivel_actual: newLevel });
  await updateMaxLevel(idUsuario, newLevel);
  return newLevel;
}

export async function getActiveSession(idUsuario) {
  const session = await getSessionsCol().findOne({ id_usuario: Number(idUsuario), fecha_fin: null });
  if (session) {
    session.id = session._id.toString();
  }
  return session;
}
