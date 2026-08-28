// Color keys confirmed via real CDP diff against this machine's live Spotify DOM — not
// css-map.json, not documentation. Etapa 11 closed the audit with exactly these 5 as
// SUPPORTED. Every other --spice-* variable tested (player, misc, tab-active,
// button-disabled, notification, notification-error, shadow, selected-row, card) had
// zero real consumers or zero rendered effect and must stay OUT of this list.
export const KNOWN_COLOR_FIELDS = [
  { key: 'button', label: 'Cor dos botões', defaultValue: '1ED760' },
  { key: 'button-active', label: 'Botão ativo', defaultValue: '1ED760' },
  { key: 'text', label: 'Texto principal', defaultValue: 'FFFFFF' },
  { key: 'subtext', label: 'Texto secundário', defaultValue: 'B3B3B3' },
  // Confirmed via CDP: --spice-main paints .main-yourLibraryX-library (the library rail).
  { key: 'main', label: 'Fundo da biblioteca', defaultValue: '121212' },
  // Confirmed via CDP: --spice-sidebar drives Root__nav-bar, Root__globalNav (topbar)
  // AND Root__now-playing-bar (player) together — one shared chrome background.
  { key: 'sidebar', label: 'Sidebar / Topo / Player', defaultValue: '000000' }
];

export const MAX_BACKGROUND_BYTES = 900 * 1024; // must match server maxDataUriBytes budget
export const MAX_IMAGE_EDGE = 1600;

// Presets are combinations invented by the Organizer, not official Spotify themes.
// Every color they set must be one of the 5 SUPPORTED keys above (enforced by test).
export const PRESETS = [
  {
    key: 'spotify-classic',
    name: 'Spotify Classic',
    colors: { button: '1ED760', 'button-active': '1ED760', main: '121212', sidebar: '000000', text: 'FFFFFF', subtext: 'B3B3B3' },
    overlayOpacity: 0.6,
    swatch: 'linear-gradient(160deg, #000000 0%, #121212 100%)'
  },
  {
    key: 'midnight',
    name: 'Midnight',
    colors: { button: '5B8CFF', 'button-active': '5B8CFF', main: '0D0D1A', sidebar: '05050C', text: 'FFFFFF', subtext: 'B3B3B3' },
    overlayOpacity: 0.65,
    swatch: 'linear-gradient(160deg, #0d0d0f 0%, #1a1a2e 100%)'
  },
  {
    key: 'crimson',
    name: 'Crimson',
    colors: { button: 'FF3B30', 'button-active': 'FF3B30', main: '1A0808', sidebar: '0D0404', text: 'FFFFFF', subtext: 'D9B3B3' },
    overlayOpacity: 0.55,
    swatch: 'linear-gradient(160deg, #1a0808 0%, #3a1212 100%)'
  },
  {
    key: 'purple-night',
    name: 'Purple Night',
    colors: { button: 'B084FF', 'button-active': 'B084FF', main: '150D24', sidebar: '0A0614', text: 'FFFFFF', subtext: 'C4B3D9' },
    overlayOpacity: 0.6,
    swatch: 'linear-gradient(160deg, #150d24 0%, #2e1a4a 100%)'
  },
  {
    key: 'minimal',
    name: 'Minimal',
    colors: { button: '1ED760', 'button-active': '1ED760', main: '161618', sidebar: '0D0D0F', text: 'FFFFFF', subtext: 'B3B3B3' },
    overlayOpacity: 0.75,
    swatch: 'linear-gradient(160deg, #0d0d0f 0%, #161618 100%)'
  }
];

const STORAGE_KEY = 'organizer:spicetify:draft';

export function loadDraftTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDraftTheme();
    return { ...defaultDraftTheme(), ...JSON.parse(raw) };
  } catch {
    return defaultDraftTheme();
  }
}

export function saveDraftTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // best-effort only; not critical if the draft can't persist locally
  }
}

export function defaultDraftTheme() {
  return {
    colors: { button: '1ED760', 'button-active': '1ED760' },
    backgroundDataUri: null,
    overlayOpacity: 0.6,
    blurPx: 0
  };
}

const THEME_FILE_FORMAT = 'spotify-organizer-theme';
const THEME_FILE_VERSION = 1;
const KNOWN_COLOR_KEYS = new Set(KNOWN_COLOR_FIELDS.map((field) => field.key));
const HEX_COLOR_RE = /^[0-9A-Fa-f]{6}$/;
const BACKGROUND_DATA_URI_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Produces the on-disk document — only the 5 confirmed-supported color keys, the
// background (if any), and the two numeric knobs. Never includes tokens, Spotify account
// data, history, or any machine-local path.
export function serializeTheme(draft) {
  const colors = {};
  for (const key of Object.keys(draft.colors || {})) {
    if (KNOWN_COLOR_KEYS.has(key) && HEX_COLOR_RE.test(draft.colors[key])) {
      colors[key] = draft.colors[key].toUpperCase();
    }
  }

  return {
    format: THEME_FILE_FORMAT,
    version: THEME_FILE_VERSION,
    theme: {
      colors,
      backgroundDataUri: draft.backgroundDataUri || null,
      overlayOpacity: clampNumber(draft.overlayOpacity, 0, 1, 0.6),
      blurPx: clampNumber(draft.blurPx, 0, 20, 0)
    }
  };
}

// Defensive parse: throws a user-facing Error (never a raw stack trace) on anything
// invalid. Returns a plain draft-shaped object on success — never mutates or touches
// localStorage/the backend itself; the caller decides what to do with the result.
export function parseThemeFile(text) {
  let document_;
  try {
    document_ = JSON.parse(text);
  } catch {
    throw new Error('Arquivo não é um JSON válido.');
  }

  if (!document_ || typeof document_ !== 'object' || Array.isArray(document_)) {
    throw new Error('Formato de arquivo inválido.');
  }
  if (document_.format !== THEME_FILE_FORMAT) {
    throw new Error('Este arquivo não é um tema do Spotify Organizer.');
  }
  if (document_.version !== THEME_FILE_VERSION) {
    throw new Error(`Versão de arquivo não suportada (${document_.version ?? 'desconhecida'}).`);
  }

  const theme = document_.theme;
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
    throw new Error('Formato de arquivo inválido.');
  }

  const colors = {};
  if (theme.colors !== undefined) {
    if (typeof theme.colors !== 'object' || theme.colors === null || Array.isArray(theme.colors)) {
      throw new Error('Formato de arquivo inválido.');
    }
    for (const [key, value] of Object.entries(theme.colors)) {
      if (!KNOWN_COLOR_KEYS.has(key)) continue; // unsupported/removed property — silently ignored, never reintroduced
      if (typeof value !== 'string' || !HEX_COLOR_RE.test(value)) {
        throw new Error(`Cor inválida para "${key}".`);
      }
      colors[key] = value.toUpperCase();
    }
  }

  let backgroundDataUri = null;
  if (theme.backgroundDataUri !== undefined && theme.backgroundDataUri !== null) {
    if (typeof theme.backgroundDataUri !== 'string' || !BACKGROUND_DATA_URI_RE.test(theme.backgroundDataUri)) {
      throw new Error('Imagem de fundo em formato inválido (esperado data:image/jpeg|png|webp;base64,...).');
    }
    const base64 = theme.backgroundDataUri.slice(theme.backgroundDataUri.indexOf(',') + 1);
    const byteLength = Math.ceil((base64.length * 3) / 4);
    if (byteLength > MAX_BACKGROUND_BYTES) {
      throw new Error(`Imagem de fundo muito grande (${Math.round(byteLength / 1024)}KB, máximo ${Math.round(MAX_BACKGROUND_BYTES / 1024)}KB).`);
    }
    backgroundDataUri = theme.backgroundDataUri;
  }

  return {
    colors,
    backgroundDataUri,
    overlayOpacity: clampNumber(theme.overlayOpacity, 0, 1, 0.6),
    blurPx: clampNumber(theme.blurPx, 0, 20, 0)
  };
}

// Loads a File into an <img>, downsizes via canvas to MAX_IMAGE_EDGE on the long side,
// and re-encodes as JPEG under MAX_BACKGROUND_BYTES. Real compression happens here so
// the server never has to run a native image library just to shrink an upload.
export function resizeImageForBackground(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error('Formato não suportado. Use JPEG, PNG ou WebP.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.85;
          let dataUri = canvas.toDataURL('image/jpeg', quality);
          while (dataUri.length * 0.75 > MAX_BACKGROUND_BYTES && quality > 0.35) {
            quality -= 0.1;
            dataUri = canvas.toDataURL('image/jpeg', quality);
          }

          if (dataUri.length * 0.75 > MAX_BACKGROUND_BYTES) {
            reject(new Error('Imagem muito grande mesmo após compressão. Escolha uma imagem menor.'));
            return;
          }

          resolve({ dataUri, width, height, wasResized: scale < 1 || quality < 0.85 });
        } catch (error) {
          reject(new Error('Falha ao processar a imagem.'));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
