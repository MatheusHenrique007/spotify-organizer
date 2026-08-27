import { ErrorIcon, RefreshIcon } from './icons.jsx';

export default function ErrorState({ title = 'Algo deu errado', error, onRetry }) {
  const message = error?.message || String(error || '');
  return (
    <div className="state-block">
      <div className="state-block-icon">
        <ErrorIcon size={32} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {onRetry && (
        <button type="button" className="button button-secondary" onClick={onRetry}>
          <RefreshIcon size={14} aria-hidden="true" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
