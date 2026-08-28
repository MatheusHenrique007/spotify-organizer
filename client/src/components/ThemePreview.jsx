import { MusicIcon } from './icons.jsx';

export default function ThemePreview({ draft }) {
  const buttonColor = draft.colors?.button ? `#${draft.colors.button}` : '#1ED760';
  const sidebarColor = draft.colors?.sidebar ? `#${draft.colors.sidebar}` : '#000000';
  const mainColor = draft.colors?.main ? `#${draft.colors.main}` : '#121212';
  const textColor = draft.colors?.text ? `#${draft.colors.text}` : '#FFFFFF';
  const subtextColor = draft.colors?.subtext ? `#${draft.colors.subtext}` : '#B3B3B3';
  const opacity = draft.overlayOpacity ?? 0.6;
  const blur = draft.blurPx ?? 0;

  const backgroundStyle = draft.backgroundDataUri
    ? {
        backgroundImage: `linear-gradient(rgba(13,13,15,${opacity}), rgba(13,13,15,${Math.min(1, opacity + 0.25)})), url(${draft.backgroundDataUri})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: blur > 0 ? `blur(${Math.min(blur, 20) / 4}px)` : 'none'
      }
    : { background: mainColor };

  return (
    <div className="theme-preview">
      <div className="theme-preview-badge">Preview</div>
      <div className="theme-preview-frame">
        <div className="theme-preview-sidebar" style={{ background: sidebarColor }}>
          <div className="theme-preview-library-row" style={{ background: mainColor }} />
          <div className="theme-preview-library-row" style={{ background: mainColor }} />
          <div className="theme-preview-library-row" style={{ background: mainColor }} />
        </div>
        <div className="theme-preview-main" style={backgroundStyle}>
          <div className="theme-preview-header" style={{ color: textColor }}>
            Sua playlist
          </div>
          <div className="theme-preview-track-list">
            <div className="theme-preview-track-label" style={{ color: textColor }}>
              Faixa exemplo
              <span style={{ color: subtextColor }}> — artista exemplo</span>
            </div>
            <div className="theme-preview-track" />
            <div className="theme-preview-track" />
          </div>
        </div>
      </div>
      <div className="theme-preview-player" style={{ background: sidebarColor }}>
        <button type="button" className="theme-preview-play" style={{ background: buttonColor }} aria-hidden="true">
          <MusicIcon size={16} />
        </button>
        <div className="theme-preview-progress">
          <div className="theme-preview-progress-fill" style={{ background: buttonColor, width: '40%' }} />
        </div>
      </div>
      <p className="muted theme-preview-note">
        Pré-visualização do Organizer — não é o Spotify real. O resultado final pode variar conforme a versão do
        Spotify instalada.
      </p>
    </div>
  );
}
