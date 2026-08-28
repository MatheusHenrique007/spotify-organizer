import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { calculateLibrarySummary } from '../lib/librarySummary.js';
import { describeSpicetifyStatus } from '../lib/spicetifyStatusPresentation.js';
import { AnalysisIcon, PlaylistIcon, PaletteIcon } from './icons.jsx';

function ThemeManagerCard() {
  const [status, setStatus] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .getSpicetifyStatus()
      .then(setStatus)
      .catch(() => setFailed(true));
  }, []);

  let body;
  if (failed) {
    body = <p className="muted">Não foi possível verificar o Theme Manager agora.</p>;
  } else if (!status) {
    body = <p className="muted">Verificando...</p>;
  } else {
    const info = describeSpicetifyStatus(status);
    const label =
      info.spicetify === 'missing'
        ? 'Spicetify não encontrado'
        : info.spotify === 'missing'
          ? 'Spotify Desktop não encontrado'
          : status.currentTheme
            ? `Tema ativo: ${status.currentTheme}`
            : 'Pronto para personalizar';
    body = <p className="muted">{label}</p>;
  }

  return (
    <Link to="/customize" className="summary-card">
      <PaletteIcon size={20} aria-hidden="true" />
      <div>
        <h3>Theme Manager</h3>
        {body}
      </div>
    </Link>
  );
}

export default function LibrarySummary({ playlists }) {
  const summary = calculateLibrarySummary(playlists);

  return (
    <div className="library-summary">
      <div className="summary-card">
        <PlaylistIcon size={20} aria-hidden="true" />
        <div>
          <h3>{summary.totalPlaylists} playlist{summary.totalPlaylists === 1 ? '' : 's'}</h3>
          <p className="muted">
            {summary.totalTracks} música{summary.totalTracks === 1 ? '' : 's'} no total
            {summary.emptyPlaylists > 0 && ` · ${summary.emptyPlaylists} vazia${summary.emptyPlaylists === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <Link to="/analysis" className="summary-card">
        <AnalysisIcon size={20} aria-hidden="true" />
        <div>
          <h3>Análise</h3>
          <p className="muted">Execute uma análise para descobrir duplicatas e playlists abandonadas.</p>
        </div>
      </Link>

      <ThemeManagerCard />
    </div>
  );
}
