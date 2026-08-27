import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { applyOperationEdits } from '../lib/planEditing.js';
import { describeOperation, isDedupeWarningVisible } from '../lib/operationPresentation.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export { isDedupeWarningVisible };

function buildDedupeSuggestions(duplicatesByPlaylist) {
  const suggestions = [];
  for (const [playlistId, value] of Object.entries(duplicatesByPlaylist)) {
    const trackUrisToRemove = [];
    for (const duplicate of value.exactDuplicates) {
      trackUrisToRemove.push(...duplicate.occurrences.slice(1).map((occurrence) => occurrence.uri));
    }
    if (trackUrisToRemove.length > 0) {
      suggestions.push({ playlistId, trackUrisToRemove });
    }
  }
  return suggestions;
}

export default function PlanBuilderPage() {
  const [analysis, setAnalysis] = useState(null);
  const [plan, setPlan] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [renameEdits, setRenameEdits] = useState({});
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState('loading');

  useEffect(() => {
    api
      .getAnalysis()
      .then((data) => {
        setAnalysis(data);
        return api.buildPlan({
          renameSuggestions: data.renameSuggestions,
          dedupeSuggestions: buildDedupeSuggestions(data.duplicatesByPlaylist),
          mergeCandidates: data.mergeCandidates
        });
      })
      .then((data) => {
        setPlan(data.plan);
        setSelectedIds(new Set(data.plan.operations.map((operation) => operation.id)));
        setPhase('review');
      })
      .catch((error_) => {
        setError(error_);
        setPhase('error');
      });
  }, []);

  function toggleOperation(id) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateRenameEdit(operationId, value) {
    setRenameEdits((previous) => ({ ...previous, [operationId]: value }));
  }

  async function handleExecute() {
    setPhase('executing');
    try {
      const effectivePlan = { ...plan, operations: applyOperationEdits(plan.operations, renameEdits) };
      const data = await api.executePlan({ plan: effectivePlan, selectedOperationIds: [...selectedIds] });
      setResults(data.results);
      setPhase('done');
    } catch (error_) {
      setError(error_);
      setPhase('error');
    }
  }

  if (phase === 'loading') return <LoadingSpinner label="Building plan..." />;
  if (phase === 'error') return <ErrorBanner error={error} />;
  if (!plan) return null;

  if (phase === 'done') {
    return (
      <div className="card">
        <h2>Execution Results</h2>
        <ul>
          {results.map((result) => (
            <li key={result.operationId}>
              <strong>{describeOperation(result).label}</strong> —{' '}
              <span className={result.success ? 'status-success' : 'status-error'}>
                {result.success ? 'Success' : `Failed: ${result.error}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Review Plan</h2>
      <p className="muted">Select which operations to apply, then confirm.</p>
      <ul className="plan-list">
        {plan.operations.map((operation) => {
          const { label, description } = describeOperation(operation);
          return (
          <li key={operation.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedIds.has(operation.id)}
                onChange={() => toggleOperation(operation.id)}
              />
              <strong>{label}</strong>
              {description && <span className="muted"> — {description}</span>}
            </label>
            {isDedupeWarningVisible(operation.type) && (
              <div className="error-banner">
                Warning: this operation may remove all occurrences of the track, not only the
                duplicates. Check the result in History after applying.
              </div>
            )}
            <details className="tech-details">
              <summary className="muted">Ver detalhes técnicos</summary>
              <pre className="tech-json">{JSON.stringify(operation.params, null, 2)}</pre>
            </details>
            {operation.type === 'rename_playlist' && (
              <div className="rename-edit">
                <label>
                  New name:{' '}
                  <input
                    type="text"
                    value={renameEdits[operation.id] ?? operation.params.newName}
                    onChange={(event) => updateRenameEdit(operation.id, event.target.value)}
                  />
                </label>
              </div>
            )}
          </li>
          );
        })}
      </ul>
      {plan.operations.length === 0 && <p>No operations suggested.</p>}
      <button
        type="button"
        className="button"
        disabled={selectedIds.size === 0 || phase === 'executing'}
        onClick={handleExecute}
      >
        {phase === 'executing' ? 'Executing...' : `Apply ${selectedIds.size} operation(s)`}
      </button>
    </div>
  );
}
