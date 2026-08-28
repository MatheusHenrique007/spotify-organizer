import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadDraftTheme,
  saveDraftTheme,
  defaultDraftTheme,
  KNOWN_COLOR_FIELDS,
  PRESETS,
  resizeImageForBackground
} from '../src/lib/spicetifyTheme.js';

function installFakeLocalStorage() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear()
  };
}

describe('spicetify theme draft persistence', () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  it('returns the default draft when nothing was saved yet', () => {
    expect(loadDraftTheme()).toEqual(defaultDraftTheme());
  });

  it('round-trips a saved draft through localStorage', () => {
    const draft = { colors: { button: 'FF3B30' }, backgroundDataUri: null, overlayOpacity: 0.4, blurPx: 0 };
    saveDraftTheme(draft);
    expect(loadDraftTheme()).toEqual(draft);
  });

  it('only exposes color fields, never invented ones', () => {
    for (const field of KNOWN_COLOR_FIELDS) {
      expect(field.key).toMatch(/^[a-z-]+$/);
      expect(field.defaultValue).toMatch(/^[0-9A-F]{6}$/);
    }
  });

  it('every preset only sets colors that are in the known field list or overlayOpacity', () => {
    const knownKeys = new Set(KNOWN_COLOR_FIELDS.map((f) => f.key));
    for (const preset of PRESETS) {
      for (const [key, value] of Object.entries(preset.colors)) {
        expect(knownKeys.has(key)).toBe(true);
        expect(value).toMatch(/^[0-9A-F]{6}$/);
      }
      expect(preset.overlayOpacity).toBeGreaterThanOrEqual(0);
      expect(preset.overlayOpacity).toBeLessThanOrEqual(1);
    }
  });

  it('never exposes a --spice-* variable classified DEAD/UNSUPPORTED in Etapa 11 (real CDP audit)', () => {
    const exposedKeys = new Set(KNOWN_COLOR_FIELDS.map((f) => f.key));
    const discarded = ['selected-row', 'player', 'misc', 'tab-active', 'button-disabled', 'notification', 'notification-error', 'shadow', 'card'];
    for (const key of discarded) {
      expect(exposedKeys.has(key)).toBe(false);
    }
  });
});

describe('resizeImageForBackground — format rejection (no canvas/Image needed for this path)', () => {
  it('rejects an unsupported mime type before touching FileReader/canvas', async () => {
    const fakeFile = { type: 'image/gif' };
    await expect(resizeImageForBackground(fakeFile)).rejects.toThrow(/não suportado/);
  });

  it('rejects a non-image file the same way', async () => {
    const fakeFile = { type: 'application/pdf' };
    await expect(resizeImageForBackground(fakeFile)).rejects.toThrow(/não suportado/);
  });
});
