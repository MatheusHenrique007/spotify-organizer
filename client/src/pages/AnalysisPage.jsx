import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getAnalysis().then(setAnalysis).catch(setError);
  }, []);

  if (error) return <ErrorBanner error={error} />;
  if (!analysis) return <LoadingSpinner label="Analyzing playlists (this can take a while)..." />;

  const duplicateEntries = Object.entries(analysis.duplicatesByPlaylist).filter(
    ([, value]) => value.exactDuplicates.length > 0 || value.fuzzyDuplicates.length > 0
  );

  return (
    <div>
      <div className="card">
        <h2>Analysis Overview</h2>
        <p className="muted">{analysis.limitations.recency}</p>
      </div>

      <div className="card">
        <h3>Duplicates</h3>
        {duplicateEntries.length === 0 && <p>No duplicates found.</p>}
        {duplicateEntries.map(([playlistId, value]) => (
          <div key={playlistId} className="sub-section">
            <strong>Playlist {playlistId}</strong>
            <ul>
              {value.exactDuplicates.map((duplicate) => (
                <li key={duplicate.trackId}>
                  Exact: {duplicate.name} — {duplicate.artist} ({duplicate.occurrences.length}x)
                </li>
              ))}
              {value.fuzzyDuplicates.map((duplicate) => (
                <li key={duplicate.fingerprint}>
                  Fuzzy: {duplicate.name} — {duplicate.artist} ({duplicate.occurrences.length}x)
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Small or Abandoned Playlists</h3>
        {analysis.smallOrAbandoned.length === 0 && <p>None found.</p>}
        <ul>
          {analysis.smallOrAbandoned.map((item) => (
            <li key={item.playlistId}>
              {item.name} — {item.trackCount} tracks
              {item.isSmall && ' (small)'}
              {item.isStale && ` (stale, ${item.daysSinceLastAdd} days since last add)`}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Similar / Merge Candidates</h3>
        {analysis.mergeCandidates.length === 0 && <p>None found.</p>}
        <ul>
          {analysis.mergeCandidates.map((candidate) => (
            <li key={`${candidate.playlistIdA}-${candidate.playlistIdB}`}>
              {candidate.nameA} + {candidate.nameB} — {candidate.reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Rename Suggestions</h3>
        {analysis.renameSuggestions.length === 0 && <p>None found.</p>}
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
        Build a Plan
      </Link>
    </div>
  );
}
