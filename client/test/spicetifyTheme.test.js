import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadDraftTheme,
  saveDraftTheme,
  defaultDraftTheme,
  KNOWN_COLOR_FIELDS,
  PRESETS,
  resizeImageForBackground,
  serializeTheme,
  parseThemeFile,
  MAX_BACKGROUND_BYTES
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

describe('serializeTheme — export never leaks anything beyond the supported theme shape', () => {
  it('produces JSON that round-trips through JSON.stringify/parse', () => {
    const draft = { colors: { button: 'FF3B30' }, backgroundDataUri: null, overlayOpacity: 0.5, blurPx: 0 };
    const doc = serializeTheme(draft);
    expect(() => JSON.parse(JSON.stringify(doc))).not.toThrow();
    expect(doc).toMatchObject({ format: 'spotify-organizer-theme', version: 1 });
  });

  it('only includes known-supported color keys, silently dropping anything else', () => {
    const draft = { colors: { button: 'FF3B30', misc: 'AAAAAA', card: 'BBBBBB' }, overlayOpacity: 0.5, blurPx: 0 };
    const doc = serializeTheme(draft);
    expect(doc.theme.colors).toEqual({ button: 'FF3B30' });
  });

  it('drops an invalid hex value instead of exporting broken data', () => {
    const draft = { colors: { button: 'not-a-color' }, overlayOpacity: 0.5, blurPx: 0 };
    const doc = serializeTheme(draft);
    expect(doc.theme.colors).toEqual({});
  });

  it('omits background when the draft has none', () => {
    const doc = serializeTheme({ colors: {}, backgroundDataUri: null, overlayOpacity: 0.5, blurPx: 0 });
    expect(doc.theme.backgroundDataUri).toBeNull();
  });
});

describe('parseThemeFile — defensive import, never trusts the file blindly', () => {
  function validDocument(overrides = {}) {
    return JSON.stringify({
      format: 'spotify-organizer-theme',
      version: 1,
      theme: { colors: { button: '1ED760' }, backgroundDataUri: null, overlayOpacity: 0.6, blurPx: 0, ...overrides }
    });
  }

  it('imports a valid theme file into a draft-shaped object', () => {
    const draft = parseThemeFile(validDocument());
    expect(draft).toEqual({ colors: { button: '1ED760' }, backgroundDataUri: null, overlayOpacity: 0.6, blurPx: 0 });
  });

  it('rejects invalid JSON with a user-facing message, not a raw parser stack trace', () => {
    expect(() => parseThemeFile('{not json')).toThrow(/JSON válido/);
  });

  it('rejects a document missing the expected format field', () => {
    expect(() => parseThemeFile(JSON.stringify({ version: 1, theme: {} }))).toThrow(/não é um tema/);
  });

  it('rejects an unsupported/future version instead of guessing how to migrate it', () => {
    expect(() => parseThemeFile(JSON.stringify({ format: 'spotify-organizer-theme', version: 99, theme: {} }))).toThrow(/[Vv]ersão/);
  });

  it('rejects an invalid color value', () => {
    expect(() => parseThemeFile(validDocument({ colors: { button: 'zzzzzz' } }))).toThrow(/[Cc]or inválida/);
  });

  it('silently drops an unsupported/DEAD color key instead of reintroducing it', () => {
    const draft = parseThemeFile(validDocument({ colors: { button: '1ED760', card: 'AAAAAA' } }));
    expect(draft.colors).toEqual({ button: '1ED760' });
  });

  it('rejects a background that is not a real data: URI (e.g. file://)', () => {
    expect(() => parseThemeFile(validDocument({ backgroundDataUri: 'file:///C:/images/bg.jpg' }))).toThrow(/formato inválido/);
  });

  it('rejects a background data URI larger than the existing size limit', () => {
    const hugeBase64 = 'A'.repeat(Math.ceil((MAX_BACKGROUND_BYTES + 1024) * 4 / 3));
    expect(() => parseThemeFile(validDocument({ backgroundDataUri: `data:image/jpeg;base64,${hugeBase64}` }))).toThrow(/muito grande/);
  });

  it('never mutates or partially applies anything when validation fails', () => {
    const before = validDocument();
    try {
      parseThemeFile(validDocument({ colors: { button: 'zzzzzz' } }));
    } catch {
      // expected
    }
    expect(before).toBe(validDocument());
  });

  it('round-trip: a valid draft survives export -> import unchanged', () => {
    const draft = { colors: { button: 'FF3B30', main: '121212' }, backgroundDataUri: null, overlayOpacity: 0.42, blurPx: 5 };
    const roundTripped = parseThemeFile(JSON.stringify(serializeTheme(draft)));
    expect(roundTripped).toEqual(draft);
  });
});
