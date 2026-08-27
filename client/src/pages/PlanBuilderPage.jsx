import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { applyOperationEdits } from '../lib/planEditing.js';
import { isDedupeWarningVisible } from '../lib/operationPresentation.js';
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
  { key: 'analysis', label: 'Analysis' },
  { key: 'plan', label: 'Plan' },
  { key: 'review', label: 'Review' },
  { key: 'executing', label: 'Execute' },
  { key: 'done', label: 'Result' }
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
  const [phase, setPhase] = useState('loading');

  useEffect(() => {
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

  if (phase === 'loading') {
    return (
      <>
        <PageHeader title="Plan Builder" subtitle="Analise e execute alterações nas suas playlists." />
        <WorkflowSteps phase={phase} />
        <LoadingSpinner label="Analisando playlists e montando o plano..." />
      </>
    );
  }

  if (phase === 'error') {
    return (
      <>
        <PageHeader title="Plan Builder" subtitle="Analise e execute alterações nas suas playlists." />
        <ErrorState title="Não foi possível montar o plano" error={error} />
      </>
    );
  }

  if (!plan) return null;

  if (phase === 'done') {
    return (
      <>
        <PageHeader title="Plan Builder" subtitle="Analise e execute alterações nas suas playlists." />
        <WorkflowSteps phase={phase} />
        <div className="card">
          <h2>Resultado da execução</h2>
          {results.map((result) => (
            <OperationCard key={result.operationId} operation={result}>
              <StatusBadge status={result.success ? 'success' : 'error'}>
                {result.success ? 'Concluído' : `Falhou: ${result.error}`}
              </StatusBadge>
            </OperationCard>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Plan Builder" subtitle="Analise e execute alterações nas suas playlists." />
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
                    Esta operação pode remover todas as ocorrências da faixa, não apenas as duplicadas. Verifique o
                    resultado no histórico após a execução.
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

          <button
            type="button"
            className="button"
            disabled={selectedIds.size === 0 || phase === 'executing'}
            onClick={handleExecute}
          >
            {phase === 'executing' ? 'Executando...' : `Aplicar ${selectedIds.size} operação(ões)`}
          </button>
        </div>
      )}
    </>
  );
}
