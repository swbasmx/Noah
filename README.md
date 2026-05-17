<div align="center">
  <img src="https://socialify.git.ci/swbasmx/Noah/image?description=Tutor+Inteligente+de+Idiomas+con+Memoria+Vectorial%2C+Transcripci%C3%B3n+de+Voz+y+Soporte+para+8+Idiomas&font=Inter&language=1&name=1&owner=1&pattern=Circuit+Board&theme=Dark" alt="Noah Socialify" width="600"/>
</div>

# ⚡ NOAH

> Un tutor de idiomas inteligente, conversacional e interactivo para Telegram con soporte para **8 idiomas** (Inglés, Ruso, Francés, Alemán, Italiano, Portugués, Japonés y Coreano), notas de voz en tiempo real con Groq Whisper, memoria contextual a largo plazo con ChromaDB, progresión interactiva de 5 ejercicios dinámicos y una Landing Page premium con transcripción de voz (STT), narrador integrado y modo claro/oscuro.

[![GitHub license](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![NodeJS](https://img.shields.io/badge/Node.js-6DA55F?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=flat&logo=telegram&logoColor=white)](https://telegram.org/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/cloud/atlas)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-fc8019?style=flat&logo=database&logoColor=white)](https://trychroma.com)

## 🎥 Project Demo & Web Portal
👉 **[Visita la Landing Page Interactiva en Vercel](https://noah-flame.vercel.app/)**

---

## ✨ Key Features

- **8 Idiomas de Aprendizaje 🇺🇸 🇷🇺 🇫🇷 🇩🇪 🇮🇹 🇵🇹 🇯🇵 🇰🇷:** Currículos pedagógicos completos de 100 niveles progresivos para cada uno de los idiomas, estructurados bajo el Marco Común Europeo de Referencia (MCER / CEFR) desde principiante (A1) hasta avanzado (C2).
- **Audio en Memoria Real-time (Groq Whisper) 🎙️:** Transcripción ultra veloz de notas de voz enviadas por Telegram, procesadas al vuelo 100% en búferes de lectura sin escribir archivos físicos locales en el disco (arquitectura ideal para Serverless en Vercel).
- **Memoria Contextual a Largo Plazo (ChromaDB) 🧠:** Base de datos vectorial confidencial que registra, analiza y recuerda los deslices gramaticales, ortográficos y fonéticos del alumno para repasar esos puntos débiles de forma personalizada en futuras sesiones.
- **Formato Visual Ultra-Limpio (Inmersión Guiada) 📝:** Instrucciones cortas y comandos imperativos directos. Para idiomas no latinos (Japonés, Coreano, Ruso) incluye de forma inteligente su transcripción fonética (Romaji/Romaja) y traducción al español para evitar la frustración del estudiante.
- **Flujo de Progresión Permanente y Estable 🎯:** Sistema inteligente de flujo y control de sesiones (`checkAndLevelUp`) que corrige deslices y bloqueos, manteniendo el progreso activo a lo largo de los 5 ejercicios por nivel hasta consolidar la subida de rango.
- **Streaming Throttled (OpenAI) 💬:** Respuestas redactadas en Telegram en tiempo real mediante buffers controlados a 800ms para evitar los rate limits de la API, filtrando de forma transparente los metadatos de evaluación pedagógica interna.
- **Landing Page Interactiva Premium con Accesibilidad 🎨:**
  * **Modo Claro / Modo Oscuro Adaptativo**: Diseño vanguardista responsivo con glassmorphism y transiciones fluidas de color.
  * **Transcriptor por Voz en Vivo (Speech to Text)**: Barra de mensajería interactiva con un botón de dictado por voz que utiliza el API de reconocimiento del navegador para transcribir lo que hablas.
  * **Narrador de Página IA**: Consola flotante con lector de texto por voz multilingüe que resalta y desplaza de forma automática los párrafos de la página web a medida que se realiza la narración.

---

## 💻 Installation Steps

Para correr Noah localmente en tu entorno de desarrollo, sigue estos sencillos pasos:

### 1. Clonar el repositorio
```bash
git clone https://github.com/swbasmx/Noah.git
cd Noah
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno (`.env`)
Crea un archivo `.env` en la raíz del proyecto y añade tus credenciales:
```env
TELEGRAM_TOKEN=tu_token_de_telegram_aquí
OPENAI_API_KEY=tu_api_key_de_openai_aquí
GROQ_API_KEY=tu_api_key_de_groq_aquí

# ChromaDB (Base Vectorial)
CHROMA_HOST=https://api.trychroma.com
CHROMA_API_KEY=tu_chroma_api_key_aquí
CHROMA_TENANT=tu_tenant_id_aquí
CHROMA_DATABASE=tu_database_name_aquí

# Base de Datos de Producción (Opcional - Si no se provee, usará SQLite local de respaldo)
MONGODB_URI=mongodb+srv://tu_usuario:tu_contraseña@tu_cluster.mongodb.net/nombre_db

TUTOR_NAME=Noah
```

### 4. Poblar las Colecciones de la Base de Datos (Seeding)
Para sembrar los 100 niveles de los diferentes idiomas en tu base de datos activa (SQLite/MongoDB) y vectorizar el soporte pedagógico, ejecuta los scripts de siembra:
```bash
# Limpiar colecciones de MongoDB si deseas un inicio fresco
node scripts/clear_db.js

# Poblar los niveles en tu base de datos activa
node scripts/seed_levels.js
```

### 5. Iniciar la aplicación local
```bash
npm start
```

---

## 🚀 Deployment (Vercel Serverless)

Este repositorio está configurado de forma nativa para desplegarse en **Vercel** usando Serverless Functions:

1. Crea un nuevo proyecto en Vercel importando tu repositorio de GitHub.
2. Agrega las variables de entorno declaradas en tu `.env` directamente en la sección de Environment Variables de Vercel.
3. Despliega el proyecto. Vercel construirá y servirá la Landing Page (`index.html`) en la raíz y expondrá el webhook en `https://tu-proyecto.vercel.app/api/bot`.
4. Vincula el Webhook oficial con Telegram haciendo una petición POST de configuración:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TU_TELEGRAM_TOKEN>/setWebhook?url=https://noah-flame.vercel.app/api/bot"
   ```

---

## 🛠 Technologies Used

- **Runtime & Bot Core:** Node.js (ESM), Telegraf (Telegram Bot Framework)
- **Base de Datos Híbrida:** MongoDB Atlas / SQLite (Sequelize)
- **Base Vectorial a Largo Plazo:** ChromaDB Cloud API
- **Modelos de IA Avanzados:** OpenAI (`gpt-4o-mini` y embeddings `text-embedding-3-small`), Groq Whisper (`whisper-large-v3-turbo` en memoria)
- **Despliegue e Infraestructura:** Vercel (Serverless Functions)
- **Frontend Dashboard:** HTML5 Semántico, CSS3 Premium variable, Vanilla JavaScript (ES6+), Web Speech Recognition API (Speech to Text) & Web Speech Synthesis API (Text to Speech).

---

## 🤝 Contribution Guidelines

¡Las contribuciones son sumamente bienvenidas! Si deseas proponer mejoras gramaticales para los niveles, traducciones adicionales, optimizaciones de red o integrar nuevos silabarios:
1. Haz un Fork del proyecto.
2. Crea tu rama de características (`git checkout -b feature/NuevoIdioma`).
3. Haz un commit de tus cambios (`git commit -m 'Añadido soporte avanzado para Coreano'`).
4. Haz push a la rama (`git push origin feature/NuevoIdioma`).
5. Abre un Pull Request describiendo detalladamente tus aportes.

---

## 📄 License

Este proyecto está bajo la Licencia MIT. Eres libre de usarlo, modificarlo y distribuirlo para fines personales o comerciales.

---

## 💬 Support

> *"El código trabaja mientras tú duermes."* — MX

Si encuentras algún bug o tienes una sugerencia de diseño, por favor abre un [Issue](https://github.com/swbasmx/Noah/issues) en este repositorio.
