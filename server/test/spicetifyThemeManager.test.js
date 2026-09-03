import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({ files: new Map() }));

vi.mock('node:fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    existsSync: (path) => store.files.has(path),
    readFileSync: (path) => store.files.get(path),
    writeFileSync: (path, data) => store.files.set(path, data)
  }
}));

vi.mock('../src/lib/config.js', () => ({
  config: {
    dataDir: 'C:/fake/data',
    spicetifyThemeConfigFile: 'C:/fake/data/spicetify-theme.json',
    spicetify: {
      themesDir: 'C:/fake/Themes',
      themeName: 'SpotifyOrganizer',
      maxCssBytes: 2 * 1024 * 1024
    }
  }
}));

describe('spicetify theme manager', () => {
  let generateTheme;

  beforeEach(async () => {
    store.files.clear();
    vi.resetModules();
    const mod = await import('../src/lib/spicetify/themeManager.js');
    generateTheme = mod.generateTheme;
  });

  it('only writes color.ini keys that are known-real spice variables', () => {
    generateTheme({ colors: { button: 'FF3B30', madeUpKey: 'AAAAAA' } });
    const ini = store.files.get('C:/fake/Themes\\SpotifyOrganizer\\color.ini') ?? [...store.files.entries()].find(([k]) => k.endsWith('color.ini'))[1];
    expect(ini).toContain('button = FF3B30');
    expect(ini).not.toContain('madeUpKey');
  });

  it('rejects an oversized base64 background image instead of silently truncating', () => {
    const hugeBase64 = 'A'.repeat(2_000_000);
    expect(() =>
      generateTheme({ backgroundDataUri: `data:image/jpeg;base64,${hugeBase64}` })
    ).toThrow(/muito grande/);
  });

  it('rejects a file:// or non-data background URI', () => {
    expect(() =>
      generateTheme({ backgroundDataUri: 'file:///C:/images/bg.jpg' })
    ).toThrow(/inválido/);
  });

  it('rejects an invalid hex color instead of writing broken CSS', () => {
    expect(() => generateTheme({ colors: { button: 'not-a-color' } })).toThrow(/inválida/);
  });

  it('targets the real DOM selectors confirmed via CDP, not the stale css-map.json one', () => {
    generateTheme({ backgroundDataUri: 'data:image/jpeg;base64,QUFB' });
    const css = [...store.files.entries()].find(([k]) => k.endsWith('user.css'))[1];
    expect(css).toContain('.Root__main-view');
    expect(css).toContain('background-color: transparent !important');
    expect(css).toContain('.main-view-container');
    expect(css).toContain('background-image:');
    expect(css).toContain('data:image/jpeg;base64,QUFB');
    expect(css).toContain('background-size: cover');
    expect(css).toContain('background-position: center');
    expect(css).not.toContain('main-appShell-mainContent');
  });

  it('also applies the background image to the confirmed "Your Library" panel selector', () => {
    generateTheme({ backgroundDataUri: 'data:image/jpeg;base64,QUFB' });
    const css = [...store.files.entries()].find(([k]) => k.endsWith('user.css'))[1];
    expect(css).toContain('.main-yourLibraryX-libraryContainer');
    const libraryRuleStart = css.indexOf('.main-yourLibraryX-libraryContainer');
    const libraryRule = css.slice(libraryRuleStart, libraryRuleStart + 300);
    expect(libraryRule).toContain('background-image:');
    expect(libraryRule).toContain('data:image/jpeg;base64,QUFB');
    expect(libraryRule).toContain('background-size: cover');
  });

  it('does not touch the library panel selector when no background image is set', () => {
    generateTheme({ colors: { button: 'FF3B30' } });
    const css = [...store.files.entries()].find(([k]) => k.endsWith('user.css'))[1];
    expect(css).not.toContain('main-yourLibraryX-libraryContainer');
  });

  it('neutralizes the right panel ::before overlay and applies the background image to the panel itself', () => {
    generateTheme({ backgroundDataUri: 'data:image/jpeg;base64,QUFB' });
    const css = [...store.files.entries()].find(([k]) => k.endsWith('user.css'))[1];

    expect(css).toContain('#Desktop_PanelContainer_Id::before');
    const beforeRuleStart = css.indexOf('#Desktop_PanelContainer_Id::before');
    const beforeRule = css.slice(beforeRuleStart, beforeRuleStart + 100);
    expect(beforeRule).toContain('background-color: transparent !important');

    const panelRuleStart = css.indexOf('#Desktop_PanelContainer_Id {');
    expect(panelRuleStart).toBeGreaterThan(-1);
    const panelRule = css.slice(panelRuleStart, panelRuleStart + 300);
    expect(panelRule).toContain('background-image:');
    expect(panelRule).toContain('data:image/jpeg;base64,QUFB');
    expect(panelRule).toContain('background-size: cover');
  });

  it('does not touch the right panel selector or its ::before when no background image is set', () => {
    generateTheme({ colors: { button: 'FF3B30' } });
    const css = [...store.files.entries()].find(([k]) => k.endsWith('user.css'))[1];
    expect(css).not.toContain('Desktop_PanelContainer_Id');
  });
});
