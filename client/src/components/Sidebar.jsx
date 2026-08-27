import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { PlaylistIcon, PlanIcon, HistoryIcon, LogOutIcon, AnalysisIcon } from './icons.jsx';

const LINKS = [
  { to: '/dashboard', label: 'Playlists', icon: PlaylistIcon },
  { to: '/analysis', label: 'Analysis', icon: AnalysisIcon },
  { to: '/plan', label: 'Plan Builder', icon: PlanIcon },
  { to: '/history', label: 'History', icon: HistoryIcon }
];

export default function Sidebar({ authenticated }) {
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await api.logout();
    navigate('/login');
    window.location.reload();
  }

  if (!authenticated) return null;

  return (
    <nav className="sidebar" aria-label="Main navigation">
      <Link to="/dashboard" className="sidebar-brand">
        <PlaylistIcon aria-hidden="true" />
        Spotify Organizer
      </Link>

      <div className="sidebar-section-label">Main</div>
      <div className="sidebar-nav">
        {LINKS.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
          return (
            <Link key={to} to={to} className="sidebar-link" aria-current={isActive ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button type="button" onClick={handleLogout} className="sidebar-logout">
          <LogOutIcon aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </nav>
  );
}
