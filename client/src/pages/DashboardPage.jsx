import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export default function DashboardPage() {
  const [profile, setProfile] = useState(null);
  const [playlists, setPlaylists] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getMe(), api.getPlaylists()])
      .then(([profileData, playlistsData]) => {
        setProfile(profileData);
        setPlaylists(playlistsData.playlists);
      })
      .catch(setError);
  }, []);

  if (error) return <ErrorBanner error={error} />;
  if (!profile || !playlists) return <LoadingSpinner />;

  return (
    <div>
      <div className="card">
        <h2>{profile.display_name || profile.id}</h2>
        <p>{profile.email}</p>
        <p>{playlists.length} playlists</p>
      </div>

      <div className="playlist-grid">
        {playlists.map((playlist) => (
          <Link key={playlist.id} to={`/playlists/${playlist.id}`} className="card playlist-card">
            <h3>{playlist.name}</h3>
            <p>{playlist.trackCount} tracks</p>
            <p className="muted">{playlist.owner}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
