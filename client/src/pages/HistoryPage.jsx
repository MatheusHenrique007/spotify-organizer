import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { describeOperation } from '../lib/operationPresentation.js';
import { describeExecutionDetails } from '../lib/historyPresentation.js';
import PageHeader from '../components/PageHeader.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { HistoryIcon } from '../components/icons.jsx';

export default function HistoryPage() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    api
      .getHistory()
      .then((data) => setHistory(data.history))
      .catch(setError);
  }, [attempt]);

  if (error) {
    return (
      <>
        <PageHeader title="Histórico" />
        <ErrorState title="Não foi possível carregar o histórico" error={error} onRetry={() => setAttempt((n) => n + 1)} />
      </>
    );
  }

  if (!history) {
    return (
      <>
        <PageHeader title="Histórico" />
        <LoadingSpinner label="Carregando histórico..." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Histórico"
        subtitle="Restauração de melhor esforço é registrada por operação, mas desfazer completamente nem sempre é possível (ex.: playlists deletadas não podem ser recriadas com o mesmo ID)."
      />

      {history.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="Nenhuma execução ainda"
          description="As operações realizadas aparecerão aqui."
          action={
            <Link to="/plan" className="button">
              Ir para Plan Builder
            </Link>
          }
        />
      ) : (
        history.map((entry) =>
          entry.type === 'spicetify_theme' ? (
            <div className="activity-entry" key={entry.id}>
              <div className="activity-entry-header">
                <strong>Personalização do Spotify · {entry.action}</strong>
                <span className="activity-timestamp">{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
              <div className="activity-result">
                <StatusBadge status={entry.result === 'success' ? 'success' : 'error'}>
                  {entry.result === 'success' ? 'Concluído' : 'Falhou'}
                </StatusBadge>
                {entry.details?.stderr && entry.result !== 'success' && <p className="muted">{entry.details.stderr}</p>}
              </div>
            </div>
          ) : (
          <div className="activity-entry" key={entry.id}>
            <div className="activity-entry-header">
              <strong>{entry.operationCount} operação(ões)</strong>
              <span className="activity-timestamp">{new Date(entry.timestamp).toLocaleString()}</span>
            </div>

            {entry.results.map((result) => {
              const execution = describeExecutionDetails(result.details);
              return (
                <div className="activity-result" key={result.operationId}>
                  <div className="activity-result-header">
                    <strong>{describeOperation(result).label}</strong>
                    <StatusBadge status={result.success ? 'success' : 'error'}>
                      {result.success ? 'Concluído' : 'Falhou'}
                    </StatusBadge>
                  </div>
                  {!result.success && <p className="muted">{result.error}</p>}
                  {execution && (
                    <details className="tech-details">
                      <summary>Detalhes da execução</summary>
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
                </div>
              );
            })}
          </div>
          )
        )
      )}
    </>
  );
}
