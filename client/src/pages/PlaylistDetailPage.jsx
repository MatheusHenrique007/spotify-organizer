import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { ArrowLeftIcon, MusicIcon } from '../components/icons.jsx';

function formatDuration(ms) {
  if (typeof ms !== 'number') return '—';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatTotalDuration(tracks) {
  const knownDurations = tracks.map((item) => item.item?.duration_ms).filter((ms) => typeof ms === 'number');
  if (knownDurations.length === 0) return null;
  const totalMs = knownDurations.reduce((sum, ms) => sum + ms, 0);
  const totalMinutes = Math.round(totalMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export default function PlaylistDetailPage() {
  const { id } = useParams();
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    Promise.all([api.getPlaylists(), api.getPlaylistTracks(id)])
      .then(([playlistsData, tracksData]) => {
        setPlaylist(playlistsData.playlists.find((item) => item.id === id) ?? null);
        setTracks(tracksData.tracks);
      })
      .catch(setError);
  }, [id, attempt]);

  if (error) {
    return <ErrorState title="Não foi possível carregar esta playlist" error={error} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  if (!tracks) return <LoadingSpinner label="Carregando faixas..." />;

  const cover = playlist?.images?.[0]?.url;
  const totalDuration = formatTotalDuration(tracks);
  const trackDigits = String(tracks.length).length;

  return (
    <>
      <Link to="/dashboard" className="back-link">
        <ArrowLeftIcon size={14} aria-hidden="true" /> Voltar
      </Link>

      <div className="detail-header">
        <div className="detail-cover">
          {cover ? <img src={cover} alt="" /> : <MusicIcon size={40} aria-hidden="true" />}
        </div>
        <div className="detail-meta">
          <h1>{playlist?.name ?? 'Playlist'}</h1>
          {playlist?.description && <p>{playlist.description}</p>}
          <p>
            {tracks.length} {tracks.length === 1 ? 'música' : 'músicas'}
            {totalDuration && ` • ${totalDuration}`}
          </p>
        </div>
      </div>

      {tracks.length === 0 ? (
        <EmptyState icon={MusicIcon} title="Nenhuma música nesta playlist" description="As faixas adicionadas aparecerão aqui." />
      ) : (
        <div className="track-list card">
          {tracks.map((item, index) => (
            <div className="track-row" key={`${item.item?.id || 'unknown'}-${index}`}>
              <span className="track-index">{String(index + 1).padStart(trackDigits, '0')}</span>
              <div className="track-name">
                <strong>{item.item?.name || 'Unavailable'}</strong>
                <span>{item.item?.artists?.map((artist) => artist.name).join(', ')}</span>
              </div>
              <span className="track-duration">{formatDuration(item.item?.duration_ms)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
