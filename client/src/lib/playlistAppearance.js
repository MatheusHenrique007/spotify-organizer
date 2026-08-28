const STORAGE_PREFIX = 'organizer:appearance:';
const MAX_IMAGE_BYTES = 400_000;

export const THEMES = [
  { key: 'midnight', label: 'Midnight', gradient: 'linear-gradient(160deg, #0d0d0f 0%, #1a1a2e 100%)' },
  { key: 'neon', label: 'Neon', gradient: 'linear-gradient(160deg, #0d0d0f 0%, #1a0a2e 50%, #2e0a3a 100%)' },
  { key: 'sunset', label: 'Sunset', gradient: 'linear-gradient(160deg, #0d0d0f 0%, #3a1a12 60%, #4a2410 100%)' },
  { key: 'cyber', label: 'Cyber', gradient: 'linear-gradient(160deg, #0d0d0f 0%, #0a2a2e 60%, #0a1a2e 100%)' },
  { key: 'forest', label: 'Forest', gradient: 'linear-gradient(160deg, #0d0d0f 0%, #0f2a18 100%)' },
  { key: 'minimal', label: 'Minimal', gradient: 'linear-gradient(160deg, #0d0d0f 0%, #161618 100%)' }
];

const DEFAULT_APPEARANCE = { themeKey: 'minimal', customImage: null, blur: true };

export function getAppearance(playlistId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + playlistId);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(playlistId, appearance) {
  try {
    localStorage.setItem(STORAGE_PREFIX + playlistId, JSON.stringify(appearance));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Não foi possível salvar a personalização neste navegador (armazenamento indisponível ou cheio).' };
  }
}

export function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error(`Imagem muito grande (máx. ${Math.round(MAX_IMAGE_BYTES / 1000)}KB para personalização local).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export function getThemeGradient(themeKey) {
  return THEMES.find((theme) => theme.key === themeKey)?.gradient ?? DEFAULT_APPEARANCE.themeKey;
}
