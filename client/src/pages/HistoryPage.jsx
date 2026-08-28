import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { describeOperation } from '../lib/operationPresentation.js';
import { describeExecutionDetails } from '../lib/historyPresentation.js';
import { filterHistory } from '../lib/historyFilter.js';
import PageHeader from '../components/PageHeader.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { HistoryIcon } from '../components/icons.jsx';

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'playlist', label: 'Playlists' },
  { value: 'spicetify', label: 'Theme Manager' }
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'success', label: 'Sucesso' },
  { value: 'error', label: 'Erro' }
];

export default function HistoryPage() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const hasActiveFilters = query.trim() !== '' || typeFilter !== 'all' || statusFilter !== 'all';
  const filteredHistory = useMemo(
    () => filterHistory(history, { query, type: typeFilter, status: statusFilter }),
    [history, query, typeFilter, statusFilter]
  );

  function clearFilters() {
    setQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
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
        <>
          <div className="history-filters">
            <input
              type="search"
              className="history-search"
              placeholder="Buscar no histórico..."
              aria-label="Buscar no histórico"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="history-filter-group" role="group" aria-label="Filtrar por tipo">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`history-filter-chip${typeFilter === option.value ? ' is-active' : ''}`}
                  onClick={() => setTypeFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="history-filter-group" role="group" aria-label="Filtrar por status">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`history-filter-chip${statusFilter === option.value ? ' is-active' : ''}`}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <EmptyState
              icon={HistoryIcon}
              title="Nenhum resultado encontrado"
              description="Ajuste a busca ou os filtros para ver outras entradas do histórico."
              action={
                hasActiveFilters && (
                  <button type="button" className="button-secondary button" onClick={clearFilters}>
                    Limpar filtros
                  </button>
                )
              }
            />
          ) : (
        filteredHistory.map((entry) =>
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
      )}
    </>
  );
}
