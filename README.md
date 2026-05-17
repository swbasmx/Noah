<div align="center">
  <img src="https://socialify.git.ci/swbasmx/Noah/image?description=Tutor+Inteligente+de+Idiomas+en+Telegram+con+Memoria+vectorial+y+Voz&font=Inter&language=1&name=1&owner=1&pattern=Circuit+Board&theme=Dark" alt="Noah Socialify" width="600"/>
</div>

# ⚡ NOAH

> Un tutor inteligente de idiomas (Inglés y Ruso) para Telegram con soporte de notas de voz en tiempo real con Groq Whisper, base de datos vectorial ChromaDB para memoria contextual a largo plazo, streaming de respuestas letra por letra (throttling de 800ms) y landing page interactiva premium.

[![GitHub license](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![NodeJS](https://img.shields.io/badge/Node.js-6DA55F?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=flat&logo=telegram&logoColor=white)](https://telegram.org/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/cloud/atlas)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-fc8019?style=flat&logo=database&logoColor=white)](https://trychroma.com)

## 🎥 Project Demo
👉 **[Ver Landing Page Interactiva](https://noah-bot.vercel.app/)**

## ✨ Features

- **Doble Idioma Nativo (Inglés y Ruso) 🇺🇸 🇷🇺:** Currículos pedagógicos completos de 100 niveles progresivos basados en el Marco Común Europeo de Referencia (MCER / CEFR) desde A1 hasta C2.
- **Audio en Memoria Real-time (Groq Whisper) 🎙️:** Transcripción ultra veloz de notas de voz capturadas directo desde Telegram, procesadas 100% en buffers de lectura sin escribir archivos físicos locales en el disco (lo que lo hace 100% compatible con la arquitectura serverless de Vercel).
- **Memoria a Largo Plazo (ChromaDB) 🧠:** Base de datos vectorial confidencial que almacena y busca los deslices gramaticales, vocabulario y giros semánticos de los alumnos en sesiones previas para repasarlos de forma inteligente en futuras interacciones.
- **Streaming Throttled (OpenAI) 💬:** Respuestas que se editan dinámicamente letra por letra a una frecuencia controlada de 800ms para evitar los rate limits de la API de Telegram, ocultando limpiamente las marcas internas de evaluación pedagógica.
- **Adaptador Dinámico de Base de Datos 🔌:** Detección automática del entorno. Si detecta la variable `MONGODB_URI` se conecta de forma segura a MongoDB Atlas en producción; si no, realiza un fallback transparente a una base de datos local SQLite.
- **Blindaje Resiliente de Procesos 🛡️:** Error boundaries integrados (`bot.catch`, `uncaughtException`, `unhandledRejection`) para asegurar que el bot jamás se apague ni sufra caídas ante fallos de conexión a internet o saturación de APIs externas.
- **Landing Page Interactiva Premium 🎨:** Sitio web cosmos-dark mode con glassmorphism y un simulador de chat interactivo que incluye **pronunciación con voz en vivo en el navegador (Web Speech API)**.

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
Para sembrar los 100 niveles de inglés y ruso en tu base de datos (SQLite/MongoDB) y vectorizarlos en ChromaDB, ejecuta los scripts de siembra:
```bash
# Limpiar colecciones de MongoDB si deseas un inicio fresco
node scripts/clear_db.js

# Poblar los niveles en tu base de datos activa
node scripts/seed_levels.js

# Subir e indexar de forma vectorial el currículo de Ruso en ChromaDB
node scripts/generate_russian_levels.js
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
   curl -X POST "https://api.telegram.org/bot<TU_TELEGRAM_TOKEN>/setWebhook?url=https://tu-proyecto.vercel.app/api/bot"
   ```

---

## 🛠 Technologies Used

- **Runtime & Framework:** Node.js (ESM), Telegraf (Telegram Bot Framework)
- **Base de Datos:** MongoDB Atlas / SQLite (Sequelize)
- **Base Vectorial:** ChromaDB Cloud API
- **Modelos de IA:** OpenAI (`gpt-4o-mini` y embeddings `text-embedding-3-small`), Groq Whisper (`whisper-large-v3-turbo` en memoria)
- **Despliegue Cloud:** Vercel (Serverless Server)
- **Frontend Landing:** HTML5 Semántico, CSS3 Premium, Vanilla JavaScript (ES6+), HTML5 Web Speech API

---

## 🤝 Contribution Guidelines

¡Las contribuciones son extremadamente bienvenidas! Si quieres proponer mejoras pedagógicas para los niveles, optimizaciones de red, o nuevos idiomas:
1. Haz un Fork del proyecto.
2. Crea tu rama de características (`git checkout -b feature/NuevoIdioma`).
3. Haz un commit de tus cambios (`git commit -m 'Añadido currículo de Alemán'`).
4. Haz push a la rama (`git push origin feature/NuevoIdioma`).
5. Abre un Pull Request describiendo detalladamente tus aportes.

---

## 📄 License

Este proyecto está bajo la Licencia MIT. Eres libre de usarlo, modificarlo y distribuirlo para fines personales o comerciales.

---

## 💬 Support

> *"El código trabaja mientras tú duermes."* — MX

Si encuentras algún bug o tienes una sugerencia de diseño, por favor abre un [Issue](https://github.com/swbasmx/Noah/issues) en este repositorio.
# Noah
