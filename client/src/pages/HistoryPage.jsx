import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { describeOperation } from '../lib/operationPresentation.js';
import { describeExecutionDetails } from '../lib/historyPresentation.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export default function HistoryPage() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getHistory()
      .then((data) => setHistory(data.history))
      .catch(setError);
  }, []);

  if (error) return <ErrorBanner error={error} />;
  if (!history) return <LoadingSpinner />;

  return (
    <div className="card">
      <h2>History</h2>
      <p className="muted">
        Best-effort restore data is captured per operation, but full undo is not always possible (e.g. deleted
        playlists cannot be recreated with the same ID).
      </p>
      {history.length === 0 && <p>No executed plans yet.</p>}
      <ul className="plan-list">
        {history.map((entry) => (
          <li key={entry.id}>
            <strong>{new Date(entry.timestamp).toLocaleString()}</strong> — {entry.operationCount} operation(s)
            <ul>
              {entry.results.map((result) => {
                const execution = describeExecutionDetails(result.details);
                return (
                  <li key={result.operationId}>
                    <strong>{describeOperation(result).label}</strong>:{' '}
                    <span className={result.success ? 'status-success' : 'status-error'}>
                      {result.success ? 'success' : `failed (${result.error})`}
                    </span>
                    {execution && (
                      <details className="tech-details">
                        <summary className="muted">Detalhes da execução</summary>
                        <ul className="muted">
                          {execution.summary && <li>{execution.summary}</li>}
                          {execution.verificationLabel && (
                            <li className={execution.verificationClass}>{execution.verificationLabel}</li>
                          )}
                          {execution.snapshotsLabel && <li>{execution.snapshotsLabel}</li>}
                          {execution.uriCount !== null && <li>Faixas afetadas: {execution.uriCount}</li>}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
