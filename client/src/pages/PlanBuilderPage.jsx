import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { applyOperationEdits } from '../lib/planEditing.js';
import { isDedupeWarningVisible } from '../lib/operationPresentation.js';
import { buildPlanPreview } from '../lib/planPreview.js';
import PageHeader from '../components/PageHeader.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import OperationCard from '../components/OperationCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import TechnicalDetails from '../components/TechnicalDetails.jsx';
import { PlanIcon, WarningIcon } from '../components/icons.jsx';

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

const STEPS = [
  { key: 'analysis', label: 'Análise' },
  { key: 'plan', label: 'Plano' },
  { key: 'review', label: 'Revisão' },
  { key: 'executing', label: 'Execução' },
  { key: 'done', label: 'Resultado' }
];

function WorkflowSteps({ phase }) {
  const activeIndex = phase === 'loading' ? 0 : STEPS.findIndex((step) => step.key === phase);
  return (
    <div className="workflow-steps">
      {STEPS.map((step, index) => {
        const state = index < activeIndex ? 'is-done' : index === activeIndex ? 'is-active' : '';
        return (
          <span key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className={`workflow-step ${state}`}>{step.label}</span>
            {index < STEPS.length - 1 && <span className="workflow-arrow">→</span>}
          </span>
        );
      })}
    </div>
  );
}

export default function PlanBuilderPage() {
  const [plan, setPlan] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [renameEdits, setRenameEdits] = useState({});
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [executeError, setExecuteError] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setPhase('loading');
    setError(null);
    api
      .getAnalysis()
      .then((data) =>
        api.buildPlan({
          renameSuggestions: data.renameSuggestions,
          dedupeSuggestions: buildDedupeSuggestions(data.duplicatesByPlaylist),
          mergeCandidates: data.mergeCandidates
        })
      )
      .then((data) => {
        setPlan(data.plan);
        setSelectedIds(new Set(data.plan.operations.map((operation) => operation.id)));
        setPhase('review');
      })
      .catch((error_) => {
        setError(error_);
        setPhase('load-error');
      });
  }, [attempt]);

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
    setExecuteError(null);
    try {
      const effectivePlan = { ...plan, operations: applyOperationEdits(plan.operations, renameEdits) };
      const data = await api.executePlan({ plan: effectivePlan, selectedOperationIds: [...selectedIds] });
      setResults(data.results);
      setPhase('done');
    } catch (error_) {
      // Execution failing does not mean the plan itself is invalid — keep the user on the
      // review screen with their selection/edits intact instead of discarding everything
      // behind a full-page error, and let them explicitly retry the same request.
      setExecuteError(error_);
      setPhase('review');
    }
  }

  if (phase === 'loading') {
    return (
      <>
        <PageHeader title="Plano" subtitle="Analise e execute alterações nas suas playlists." />
        <WorkflowSteps phase={phase} />
        <LoadingSpinner label="Analisando playlists e montando o plano..." />
      </>
    );
  }

  if (phase === 'load-error') {
    return (
      <>
        <PageHeader title="Plano" subtitle="Analise e execute alterações nas suas playlists." />
        <ErrorState title="Não foi possível montar o plano" error={error} onRetry={() => setAttempt((n) => n + 1)} />
      </>
    );
  }

  if (!plan) return null;

  if (phase === 'done') {
    return (
      <>
        <PageHeader title="Plano" subtitle="Analise e execute alterações nas suas playlists." />
        <WorkflowSteps phase={phase} />
        <div className="card">
          <h2>Resultado da execução</h2>
          <div className="operation-grid">
            {results.map((result) => (
              <OperationCard key={result.operationId} operation={result}>
                <StatusBadge status={result.success ? 'success' : 'error'}>
                  {result.success ? 'Concluído' : `Falhou: ${result.error}`}
                </StatusBadge>
              </OperationCard>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Plano" subtitle="Analise e execute alterações nas suas playlists." />
      <WorkflowSteps phase={phase} />

      {plan.operations.length === 0 ? (
        <EmptyState
          icon={PlanIcon}
          title="Nenhuma operação sugerida"
          description="A análise não encontrou alterações para sugerir no momento."
        />
      ) : (
        <div className="card">
          <h2>Revisar plano</h2>
          <p className="muted">Selecione quais operações aplicar e confirme.</p>

          <div className="operation-grid">
            {plan.operations.map((operation) => (
              <OperationCard
                key={operation.id}
                operation={operation}
                checked={selectedIds.has(operation.id)}
                onToggle={() => toggleOperation(operation.id)}
              >
                {isDedupeWarningVisible(operation.type) && (
                  <div className="warning-banner">
                    <WarningIcon size={16} aria-hidden="true" />
                    <span>
                      Esta operação pode remover todas as ocorrências da faixa, não apenas as duplicadas. Verifique
                      o resultado no histórico após a execução.
                    </span>
                  </div>
                )}
                <TechnicalDetails data={operation.params} />
                {operation.type === 'rename_playlist' && (
                  <div className="rename-edit">
                    <label>
                      Novo nome:{' '}
                      <input
                        type="text"
                        value={renameEdits[operation.id] ?? operation.params.newName}
                        onChange={(event) => updateRenameEdit(operation.id, event.target.value)}
                      />
                    </label>
                  </div>
                )}
              </OperationCard>
            ))}
          </div>

          {executeError && (
            <div className="editor-inline-error">
              <StatusBadge status="error">Não foi possível executar o plano</StatusBadge>
              <p>{executeError.message || String(executeError)}</p>
            </div>
          )}

          <div className="editor-actions-row" style={{ marginTop: 'var(--space-4)' }}>
            <button
              type="button"
              className="button-secondary button"
              disabled={selectedIds.size === 0 || phase === 'executing'}
              onClick={() => setPreviewVisible((visible) => !visible)}
            >
              {previewVisible ? 'Ocultar pré-visualização' : 'Pré-visualizar alterações'}
            </button>
            <button
              type="button"
              className="button"
              disabled={selectedIds.size === 0 || phase === 'executing'}
              onClick={handleExecute}
            >
              {phase === 'executing' ? 'Executando...' : executeError ? 'Tentar novamente' : `Aplicar ${selectedIds.size} operação(ões)`}
            </button>
          </div>

          {previewVisible && (
            <div className="plan-preview">
              <StatusBadge status="warning">Preview</StatusBadge>
              <p className="muted">Nenhuma alteração foi feita. Isto só mostra o que seria enviado ao Spotify.</p>
              {(() => {
                const preview = buildPlanPreview(applyOperationEdits(plan.operations, renameEdits), selectedIds);
                return (
                  <ul className="plan-preview-list">
                    {preview.items.map((item) => (
                      <li key={item.id} className="plan-preview-item">
                        <strong>{item.label}</strong>
                        <span className="muted">{item.description}</span>
                        {item.hasWarning && (
                          <span className="plan-preview-warning">
                            <WarningIcon size={14} aria-hidden="true" /> pode remover mais do que o esperado
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </>
  );
}
