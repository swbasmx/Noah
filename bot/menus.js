import { Markup } from 'telegraf';

// ─── TECLADOS INLINE ─────────────────────────────────────────────────────────

/**
 * Primer botón: confirmar idioma nativo detectado automáticamente.
 * @param {string} langName  — nombre legible del idioma, ej. "Español"
 */
export function confirmNativeLangKeyboard(langName) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`✅ Sí, mi idioma nativo es ${langName}`, `native_confirm`)],
    [Markup.button.callback('🌐 No, elegir otro idioma', 'native_change')],
  ]);
}

/**
 * Selector de idioma nativo (cuando el usuario quiere cambiar).
 */
export function nativeLangKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇪🇸 Español',    'native_es'),
      Markup.button.callback('🇧🇷 Portugués',  'native_pt'),
    ],
    [
      Markup.button.callback('🇫🇷 Français',   'native_fr'),
      Markup.button.callback('🇩🇪 Deutsch',    'native_de'),
    ],
    [Markup.button.callback('🌐 Otro',          'native_other')],
  ]);
}

/**
 * Selector de idioma objetivo (qué quiere aprender).
 * Por ahora solo inglés; expandible con más botones.
 */
export function targetLangKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇺🇸 Inglés', 'target_en'),
      Markup.button.callback('🇷🇺 Ruso', 'target_ru')
    ]
  ]);
}

/**
 * Selector de nivel de entrada.
 */
export function initialLevelKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👶 Soy principiante total',        'level_1')],
    [Markup.button.callback('📚 Ya sé algo, quiero detectar mi nivel', 'level_detect')],
  ]);
}

/**
 * Teclado del menú principal (mostrado en /menu).
 */
export function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊 Mi progreso',         'menu_progress')],
    [Markup.button.callback('🔄 Cambiar idioma',       'menu_change_lang')],
    [Markup.button.callback('💬 Modo conversación libre', 'menu_free_mode')],
    [Markup.button.callback('⚠️ Mis errores frecuentes', 'menu_errors')],
  ]);
}
