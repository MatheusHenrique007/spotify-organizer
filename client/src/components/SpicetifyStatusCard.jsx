import { describeSpicetifyStatus } from '../lib/spicetifyStatusPresentation.js';
import StatusBadge from './StatusBadge.jsx';
import { RefreshIcon } from './icons.jsx';

function dot(state) {
  if (state === 'ok' || state === 'closed') return '🟢';
  if (state === 'running') return '🟢';
  if (state === 'missing') return '🔴';
  return '⚪';
}

export default function SpicetifyStatusCard({ status, onRefresh, onUpdateBackup, onRestore, busy }) {
  const info = describeSpicetifyStatus(status);

  return (
    <div className="card spicetify-status-card">
      <div className="spicetify-status-row">
        <span>{dot(info.spicetify)} Spicetify</span>
        <span className="muted">{status?.installed ? `v${status.version || '?'}` : 'não encontrado'}</span>
      </div>
      <div className="spicetify-status-row">
        <span>{dot(info.spotify)} Spotify Desktop</span>
        <span className="muted">
          {status?.spotifyInstalled ? (status.spotifyRunning ? 'aberto' : 'fechado') : 'não encontrado'}
        </span>
      </div>
      <div className="spicetify-status-row">
        <span>{dot(info.backup)} Backup</span>
        <span className="muted">{status?.backupAvailable ? 'disponível' : 'ausente'}</span>
      </div>
      <div className="spicetify-status-row">
        <span>Tema atual</span>
        <span className="muted">{status?.currentTheme || '—'}</span>
      </div>

      {info.message && (
        <div className="spicetify-status-warning">
          <StatusBadge status="warning">Atenção</StatusBadge>
          <p>{info.message}</p>
        </div>
      )}

      <div className="spicetify-status-actions">
        <button type="button" className="button-secondary button" onClick={onRefresh} disabled={busy}>
          <RefreshIcon size={14} aria-hidden="true" /> Atualizar status
        </button>
        <button type="button" className="button-secondary button" onClick={onUpdateBackup} disabled={busy}>
          Atualizar backup
        </button>
        <button type="button" className="button-secondary button" onClick={onRestore} disabled={busy || !status?.backupAvailable}>
          Restaurar aparência original
        </button>
      </div>
    </div>
  );
}
