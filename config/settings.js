import { config } from 'dotenv';
config();

function require_env(key) {
  const val = process.env[key];
  if (!val) throw new Error(`❌ Falta variable de entorno: ${key}`);
  return val;
}

export const settings = {
  telegram: {
    token: require_env('TELEGRAM_TOKEN'),
  },
  openai: {
    apiKey: require_env('OPENAI_API_KEY'),
    model:  process.env.GPT_MODEL || 'gpt-4o-mini',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
  },
  chroma: {
    host:     process.env.CHROMA_HOST     || 'https://api.trychroma.com',
    apiKey:   process.env.CHROMA_API_KEY  || '',
    tenant:   process.env.CHROMA_TENANT   || '',
    database: process.env.CHROMA_DATABASE || '',
  },
  session: {
    maxHistory:      parseInt(process.env.MAX_HISTORY_MESSAGES)          || 15,
    maxChromaResults: parseInt(process.env.MAX_CHROMA_RESULTS)           || 3,
    sessionsToLevelUp: parseInt(process.env.SESSIONS_REQUIRED_TO_LEVEL_UP) || 1,
  },
  tutor: {
    name: process.env.TUTOR_NAME || 'Noah',
  },
};
