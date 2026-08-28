import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';
import PlaylistCard from '../components/PlaylistCard.jsx';
import LibrarySummary from '../components/LibrarySummary.jsx';
import { PlaylistGridSkeleton } from '../components/LoadingSpinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { PlaylistIcon } from '../components/icons.jsx';

export default function DashboardPage() {
  const [profile, setProfile] = useState(null);
  const [playlists, setPlaylists] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    Promise.all([api.getMe(), api.getPlaylists()])
      .then(([profileData, playlistsData]) => {
        setProfile(profileData);
        setPlaylists(playlistsData.playlists);
      })
      .catch(setError);
  }, [attempt]);

  if (error) {
    return (
      <>
        <PageHeader title="Playlists" subtitle="Gerencie suas playlists do Spotify." />
        <ErrorState
          title="Não foi possível carregar suas playlists"
          error={error}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </>
    );
  }

  if (!profile || !playlists) {
    return (
      <>
        <PageHeader title="Playlists" subtitle="Gerencie suas playlists do Spotify." />
        <PlaylistGridSkeleton />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Playlists" subtitle="Gerencie suas playlists do Spotify." />
      <p className="page-header-meta">
        {profile.display_name || profile.id} · {playlists.length} playlist{playlists.length === 1 ? '' : 's'}
      </p>

      {playlists.length > 0 && <LibrarySummary playlists={playlists} />}

      {playlists.length === 0 ? (
        <EmptyState
          icon={PlaylistIcon}
          title="Nenhuma playlist encontrada"
          description="Suas playlists do Spotify aparecerão aqui."
        />
      ) : (
        <div className="playlist-grid">
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}
    </>
  );
}
