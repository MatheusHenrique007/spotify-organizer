import { KNOWN_COLOR_FIELDS, PRESETS } from '../lib/spicetifyTheme.js';

export default function ThemeEditor({ draft, onChange, imageError, imageBusy, onImagePick }) {
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
