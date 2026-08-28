import { useState } from 'react';
import { KNOWN_COLOR_FIELDS, PRESETS, serializeTheme, parseThemeFile } from '../lib/spicetifyTheme.js';

export default function ThemeEditor({ draft, onChange, imageError, imageBusy, onImagePick }) {
  const [importError, setImportError] = useState(null);
  const [importMessage, setImportMessage] = useState(null);

  function setColor(key, value) {
    onChange({ ...draft, colors: { ...draft.colors, [key]: value.replace('#', '').toUpperCase() } });
  }

  function applyPreset(preset) {
    onChange({ ...draft, colors: { ...draft.colors, ...preset.colors }, overlayOpacity: preset.overlayOpacity });
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    await onImagePick(file);
  }

  function handleExportTheme() {
    const doc = serializeTheme(draft);
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spotify-theme.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportError(null);
    setImportMessage(null);

    const reader = new FileReader();
    reader.onerror = () => setImportError('Não foi possível ler o arquivo.');
    reader.onload = () => {
      try {
        const imported = parseThemeFile(reader.result);
        onChange(imported);
        setImportMessage('Tema importado.');
      } catch (error) {
        setImportError(error.message);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="theme-editor">
      <div className="theme-editor-section">
        <h3>Presets</h3>
        <div className="theme-preset-grid">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="theme-preset-swatch"
              style={{ background: preset.swatch }}
              onClick={() => applyPreset(preset)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="theme-editor-section">
        <h3>Importar / Exportar</h3>
        <div className="theme-import-export-row">
          <button type="button" className="button-secondary button" onClick={handleExportTheme}>
            Exportar tema
          </button>
          <label className="button-secondary button theme-import-label">
            Importar tema
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Importar arquivo de tema"
              onChange={handleImportFile}
              className="theme-import-input"
            />
          </label>
        </div>
        {importMessage && <p className="muted">{importMessage}</p>}
        {importError && <p className="editor-inline-error">{importError}</p>}
      </div>

      <div className="theme-editor-section">
        <h3>
          <label htmlFor="theme-background-file">Fundo</label>
        </h3>
        <input
          id="theme-background-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Escolher imagem de fundo"
          onChange={handleFile}
          disabled={imageBusy}
        />
        <p className="muted">A imagem é redimensionada e comprimida localmente antes de ser aplicada no Spotify.</p>
        {imageBusy && <p className="muted">Processando imagem...</p>}
        {imageError && <p className="editor-inline-error">{imageError}</p>}
        {draft.backgroundDataUri && (
          <button type="button" className="button-secondary button" onClick={() => onChange({ ...draft, backgroundDataUri: null })}>
            Remover imagem
          </button>
        )}
      </div>

      <div className="theme-editor-section">
        <h3>
          <label htmlFor="theme-overlay-range">Intensidade do overlay</label>
        </h3>
        <input
          id="theme-overlay-range"
          type="range"
          min="0"
          max="100"
          aria-valuetext={`${Math.round((draft.overlayOpacity ?? 0.6) * 100)}%`}
          value={Math.round((draft.overlayOpacity ?? 0.6) * 100)}
          onChange={(event) => onChange({ ...draft, overlayOpacity: Number(event.target.value) / 100 })}
        />
      </div>

      <div className="theme-editor-section">
        <h3>
          <label htmlFor="theme-blur-range">Blur</label> <span className="theme-editor-experimental">experimental</span>
        </h3>
        <p className="muted">Ainda não validado em todos os elementos do Spotify Desktop.</p>
        <input
          id="theme-blur-range"
          type="range"
          min="0"
          max="20"
          aria-valuetext={`${draft.blurPx ?? 0}px`}
          value={draft.blurPx ?? 0}
          onChange={(event) => onChange({ ...draft, blurPx: Number(event.target.value) })}
        />
      </div>

      <div className="theme-editor-section">
        <h3>Cores</h3>
        {KNOWN_COLOR_FIELDS.map((field) => (
          <label key={field.key} className="theme-color-row">
            <span>{field.label}</span>
            <input
              type="color"
              value={`#${draft.colors?.[field.key] || field.defaultValue}`}
              onChange={(event) => setColor(field.key, event.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
