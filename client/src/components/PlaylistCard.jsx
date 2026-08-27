import { Link } from 'react-router-dom';
import { MusicIcon, ArrowRightIcon } from './icons.jsx';

export default function PlaylistCard({ playlist }) {
  const cover = playlist.images?.[0]?.url;

  return (
    <Link to={`/playlists/${playlist.id}`} className="playlist-card">
      <div className="playlist-card-cover">
        {cover ? (
          <img src={cover} alt="" />
        ) : (
          <MusicIcon size={32} aria-hidden="true" />
        )}
      </div>
      <div className="playlist-card-body">
        <h3>{playlist.name}</h3>
        <p className="playlist-card-meta">
          {playlist.trackCount} {playlist.trackCount === 1 ? 'música' : 'músicas'} · {playlist.owner}
        </p>
        <span className="playlist-card-link">
          Abrir playlist <ArrowRightIcon size={12} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
