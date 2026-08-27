import { Navigate, useSearchParams } from 'react-router-dom';
import { PlaylistIcon } from '../components/icons.jsx';

export default function LoginPage({ authenticated }) {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  if (authenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="card login-card">
      <PlaylistIcon size={32} aria-hidden="true" />
      <h1>Spotify Organizer</h1>
      <p className="muted">Organize suas playlists com segurança.</p>
      {error && <div className="error-banner">Login failed: {error}</div>}
      <a className="button" href="/api/auth/login">
        Conectar com Spotify
      </a>
    </div>
  );
}
