import { MusicIcon } from './icons.jsx';
import { getThemeGradient } from '../lib/playlistAppearance.js';

export default function PlaylistHero({ playlist, meta, cover, appearance, onPersonalize, onEdit }) {
  const backgroundImage = appearance.customImage || cover;
  const gradient = getThemeGradient(appearance.themeKey);

  return (
    <div className="playlist-hero">
      <div
        className="playlist-hero-background"
        style={{
          backgroundImage: backgroundImage
            ? `linear-gradient(180deg, rgba(13,13,15,0.55) 0%, rgba(13,13,15,0.92) 100%), url(${backgroundImage})`
            : gradient,
          filter: appearance.blur && backgroundImage ? 'blur(28px) brightness(0.6)' : 'none'
        }}
        aria-hidden="true"
      />
      <div className="playlist-hero-content">
        <div className="playlist-hero-cover">
          {cover ? <img src={cover} alt="" /> : <MusicIcon size={40} aria-hidden="true" />}
        </div>
        <div className="playlist-hero-meta">
          <span className="playlist-hero-kicker">Playlist</span>
          <h1>{playlist?.name ?? 'Playlist'}</h1>
          {playlist?.description && <p className="playlist-hero-description">{playlist.description}</p>}
          <p className="playlist-hero-stats">{meta}</p>
          <div className="playlist-hero-actions">
            <button type="button" className="button" onClick={onEdit}>
              Editar playlist
            </button>
            <button type="button" className="button button-secondary" onClick={onPersonalize}>
              Personalizar visual
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
