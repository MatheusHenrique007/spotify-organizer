import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export default function PlaylistDetailPage() {
  const { id } = useParams();
  const [tracks, setTracks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getPlaylistTracks(id)
      .then((data) => setTracks(data.tracks))
      .catch(setError);
  }, [id]);

  if (error) return <ErrorBanner error={error} />;
  if (!tracks) return <LoadingSpinner />;

  return (
    <div className="card">
      <h2>Playlist Tracks</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Artist</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((item, index) => (
            <tr key={`${item.item?.id || 'unknown'}-${index}`}>
              <td>{item.item?.name || 'Unavailable'}</td>
              <td>{item.item?.artists?.map((artist) => artist.name).join(', ')}</td>
              <td>{item.added_at ? new Date(item.added_at).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
