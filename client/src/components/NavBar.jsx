import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function NavBar({ authenticated }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await api.logout();
    navigate('/login');
    window.location.reload();
  }

  return (
    <nav className="navbar">
      <Link to="/dashboard" className="brand">
        Spotify Organizer
      </Link>
      {authenticated && (
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/analysis">Analysis</Link>
          <Link to="/plan">Plan</Link>
          <Link to="/history">History</Link>
          <button type="button" onClick={handleLogout} className="link-button">
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}
