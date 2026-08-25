import { Navigate, useSearchParams } from 'react-router-dom';

export default function LoginPage({ authenticated }) {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  if (authenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="card login-card">
      <h1>Spotify Playlist Organizer</h1>
      <p>Log in with your Spotify account to analyze and reorganize your playlists.</p>
      {error && <div className="error-banner">Login failed: {error}</div>}
      <a className="button" href="/api/auth/login">
        Log in with Spotify
      </a>
    </div>
  );
}
