import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SpicetifyStatusCard from '../components/SpicetifyStatusCard.jsx';
import ThemeEditor from '../components/ThemeEditor.jsx';
import ThemePreview from '../components/ThemePreview.jsx';
import { loadDraftTheme, saveDraftTheme, resizeImageForBackground } from '../lib/spicetifyTheme.js';
import { describeApplyError } from '../lib/spicetifyStatusPresentation.js';

const APPLY_STEPS = [
  { key: 'theme', label: 'Preparando tema' },
  { key: 'apply', label: 'Aplicando no Spotify' },
  { key: 'done', label: 'Concluído' }
];

export default function CustomizePage() {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState(() => loadDraftTheme());
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState(null);

  const [applyPhase, setApplyPhase] = useState('idle'); // idle -> theme -> apply -> done -> error
  const [applyResult, setApplyResult] = useState(null);
  const [applyErrorInfo, setApplyErrorInfo] = useState(null);
  const [pendingConfirmClose, setPendingConfirmClose] = useState(false);

  const [restorePhase, setRestorePhase] = useState('idle'); // idle -> confirm -> running -> done -> error
  const [restoreResult, setRestoreResult] = useState(null);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatusError(null);
    api.getSpicetifyStatus().then(setStatus).catch(setStatusError);
  }, [attempt]);

  useEffect(() => {
    saveDraftTheme(draft);
  }, [draft]);

  async function handleImagePick(file) {
    setImageBusy(true);
    setImageError(null);
    try {
      const { dataUri } = await resizeImageForBackground(file);
      setDraft((previous) => ({ ...previous, backgroundDataUri: dataUri }));
    } catch (error) {
      setImageError(error.message);
    } finally {
      setImageBusy(false);
    }
  }

  async function runApplyFlow(confirmClose) {
    setApplyPhase('theme');
    setApplyErrorInfo(null);
    setApplyResult(null);
    setBusy(true);
    try {
      await api.saveSpicetifyTheme(draft);
      setApplyPhase('apply');
      const result = await api.applySpicetifyTheme({ confirmClose });
      setApplyResult(result);
      setApplyPhase('done');
      setPendingConfirmClose(false);
      setAttempt((n) => n + 1);
    } catch (error) {
      const info = describeApplyError(error);
      setApplyErrorInfo(info);
      setApplyPhase('error');
      if (info.requiresConfirmClose) {
        setPendingConfirmClose(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateBackup() {
    setBusy(true);
    try {
      await api.backupSpicetify({ regenerate: true });
      setAttempt((n) => n + 1);
    } catch (error) {
      setApplyErrorInfo(describeApplyError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(confirmClose) {
    setRestorePhase('running');
    setBusy(true);
    try {
      const result = await api.restoreSpicetify({ confirmClose });
      setRestoreResult({ ok: true, result });
      setRestorePhase('done');
      setAttempt((n) => n + 1);
    } catch (error) {
      const info = describeApplyError(error);
      if (info.requiresConfirmClose && !confirmClose) {
        setRestorePhase('confirm-close');
      } else {
        setRestoreResult({ ok: false, info });
        setRestorePhase('error');
      }
    } finally {
      setBusy(false);
    }
  }

  if (statusError) {
    return (
      <>
        <PageHeader title="Personalizar Spotify" />
        <ErrorState title="Não foi possível verificar o Spicetify" error={statusError} onRetry={() => setAttempt((n) => n + 1)} />
      </>
    );
  }

  if (!status) return <LoadingSpinner label="Verificando Spicetify e Spotify Desktop..." />;

  return (
    <>
      <PageHeader title="Personalizar Spotify" subtitle="Transforme a aparência do seu Spotify Desktop real, aplicada através do Spicetify." />

      <SpicetifyStatusCard
        status={status}
        busy={busy}
        onRefresh={() => setAttempt((n) => n + 1)}
        onUpdateBackup={handleUpdateBackup}
        onRestore={() => setRestorePhase('confirm')}
      />

      <div className="customize-grid">
        <ThemeEditor draft={draft} onChange={setDraft} imageBusy={imageBusy} imageError={imageError} onImagePick={handleImagePick} />
        <ThemePreview draft={draft} />
      </div>

      <div className="card customize-apply-card">
        <h3>Aplicar no Spotify Desktop</h3>
        <p className="muted">
          Isto grava um tema real do Spicetify e executa <code>spicetify apply</code> no seu Spotify instalado.
        </p>

        {applyPhase !== 'idle' && (
          <div className="apply-steps">
            {APPLY_STEPS.map((step, index) => {
              const currentIndex = APPLY_STEPS.findIndex((s) => s.key === applyPhase);
              const state =
                applyPhase === 'error'
                  ? 'error'
                  : index < currentIndex || applyPhase === 'done'
                    ? 'done'
                    : index === currentIndex
                      ? 'active'
                      : 'pending';
              return (
                <div key={step.key} className={`apply-step apply-step-${state}`}>
                  {state === 'done' ? '✓' : state === 'active' ? '●' : state === 'error' ? '✕' : '○'} {step.label}
                </div>
              );
            })}
          </div>
        )}

        {applyPhase === 'error' && applyErrorInfo && (
          <div className="editor-inline-error">
            <StatusBadge status="error">Falha ao aplicar</StatusBadge>
            <p>{applyErrorInfo.message}</p>
            {pendingConfirmClose && (
              <div className="editor-actions-row">
                <button type="button" className="button" onClick={() => runApplyFlow(true)}>
                  Fechar Spotify e aplicar
                </button>
              </div>
            )}
            {applyErrorInfo.requiresBackupUpdate && (
              <div className="editor-actions-row">
                <button type="button" className="button" onClick={handleUpdateBackup}>
                  Atualizar backup
                </button>
              </div>
            )}
          </div>
        )}

        {applyPhase === 'done' && applyResult && (
          <div>
            <StatusBadge status={applyResult.ok ? 'success' : 'error'}>
              {applyResult.ok ? 'Tema aplicado no Spotify' : 'Aplicação concluiu com falha'}
            </StatusBadge>
          </div>
        )}

        <div className="editor-actions-row">
          <button
            type="button"
            className="button"
            disabled={busy || applyPhase === 'theme' || applyPhase === 'apply'}
            onClick={() => runApplyFlow(false)}
          >
            {busy && (applyPhase === 'theme' || applyPhase === 'apply') ? 'Aplicando no Spotify...' : 'Aplicar no Spotify'}
          </button>
        </div>
      </div>

      {(restorePhase === 'confirm' || restorePhase === 'confirm-close') && (
        <div className="card customize-apply-card">
          <p>
            {restorePhase === 'confirm-close'
              ? 'Spotify está aberto. É necessário fechá-lo para restaurar.'
              : 'Isso removerá as personalizações aplicadas pelo Organizer no Spotify Desktop.'}
          </p>
          <div className="editor-actions-row">
            <button type="button" className="button-secondary button" onClick={() => setRestorePhase('idle')}>
              Cancelar
            </button>
            <button type="button" className="button" onClick={() => handleRestore(restorePhase === 'confirm-close')}>
              {restorePhase === 'confirm-close' ? 'Fechar Spotify e restaurar' : 'Restaurar Spotify'}
            </button>
          </div>
        </div>
      )}

      {restorePhase === 'done' && restoreResult?.ok && (
        <StatusBadge status="success">Spotify restaurado</StatusBadge>
      )}
      {restorePhase === 'error' && restoreResult && !restoreResult.ok && (
        <div className="editor-inline-error">
          <StatusBadge status="error">Falha ao restaurar</StatusBadge>
          <p>{restoreResult.info.message}</p>
        </div>
      )}
    </>
  );
}
