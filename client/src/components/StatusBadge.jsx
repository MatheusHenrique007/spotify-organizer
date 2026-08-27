import { CheckIcon, ErrorIcon, WarningIcon } from './icons.jsx';

const VARIANTS = {
  success: { className: 'status-badge-success', Icon: CheckIcon },
  error: { className: 'status-badge-error', Icon: ErrorIcon },
  warning: { className: 'status-badge-warning', Icon: WarningIcon }
};

export default function StatusBadge({ status, children }) {
  const variant = VARIANTS[status] ?? VARIANTS.success;
  const Icon = variant.Icon;
  return (
    <span className={`status-badge ${variant.className}`}>
      <Icon size={12} aria-hidden="true" />
      {children}
    </span>
  );
}
