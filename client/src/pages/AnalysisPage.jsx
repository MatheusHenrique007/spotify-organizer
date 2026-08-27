import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorState from '../components/ErrorState.jsx';

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    api.getAnalysis().then(setAnalysis).catch(setError);
  }, [attempt]);

  if (error) {
    return (
      <>
        <PageHeader title="Análise" />
        <ErrorState title="Não foi possível analisar suas playlists" error={error} onRetry={() => setAttempt((n) => n + 1)} />
      </>
    );
  }

  if (!analysis) {
    return (
      <>
        <PageHeader title="Análise" />
        <LoadingSpinner label="Analisando playlists (isso pode levar um tempo)..." />
      </>
    );
  }

  const duplicateEntries = Object.entries(analysis.duplicatesByPlaylist).filter(
    ([, value]) => value.exactDuplicates.length > 0 || value.fuzzyDuplicates.length > 0
  );

  return (
    <>
      <PageHeader title="Análise" subtitle={analysis.limitations.recency} />

      <div className="card">
        <h3>Duplicatas</h3>
        {duplicateEntries.length === 0 && <p className="muted">Nenhuma duplicata encontrada.</p>}
        {duplicateEntries.map(([playlistId, value]) => (
          <div key={playlistId} className="sub-section">
            <strong>Playlist {playlistId}</strong>
            <ul>
              {value.exactDuplicates.map((duplicate) => (
                <li key={duplicate.trackId}>
                  Exata: {duplicate.name} — {duplicate.artist} ({duplicate.occurrences.length}x)
                </li>
              ))}
              {value.fuzzyDuplicates.map((duplicate) => (
                <li key={duplicate.fingerprint}>
                  Similar: {duplicate.name} — {duplicate.artist} ({duplicate.occurrences.length}x)
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Playlists pequenas ou abandonadas</h3>
        {analysis.smallOrAbandoned.length === 0 && <p className="muted">Nenhuma encontrada.</p>}
        <ul>
          {analysis.smallOrAbandoned.map((item) => (
            <li key={item.playlistId}>
              {item.name} — {item.trackCount} músicas
              {item.isSmall && ' (pequena)'}
              {item.isStale && ` (parada há ${item.daysSinceLastAdd} dias)`}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Playlists semelhantes / candidatas a fusão</h3>
        {analysis.mergeCandidates.length === 0 && <p className="muted">Nenhuma encontrada.</p>}
        <ul>
          {analysis.mergeCandidates.map((candidate) => (
            <li key={`${candidate.playlistIdA}-${candidate.playlistIdB}`}>
              {candidate.nameA} + {candidate.nameB} — {candidate.reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Sugestões de renomeação</h3>
        {analysis.renameSuggestions.length === 0 && <p className="muted">Nenhuma encontrada.</p>}
        <ul>
          {analysis.renameSuggestions.map((suggestion) => (
            <li key={suggestion.playlistId}>
              {suggestion.currentName} → <strong>{suggestion.suggestedName}</strong>
              <br />
              <span className="muted">{suggestion.suggestedDescription}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link to="/plan" className="button">
        Criar plano
      </Link>
    </>
  );
}
