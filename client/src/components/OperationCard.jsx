import { describeOperation } from '../lib/operationPresentation.js';
import { PlaylistIcon, MusicIcon, RefreshIcon, PlanIcon } from './icons.jsx';

const OPERATION_ICONS = {
  create_playlist: PlaylistIcon,
  rename_playlist: PlaylistIcon,
  change_description: PlaylistIcon,
  add_tracks: MusicIcon,
  remove_tracks: MusicIcon,
  dedupe_tracks: MusicIcon,
  reorder_tracks: RefreshIcon,
  replace_tracks: MusicIcon,
  change_cover_image: PlaylistIcon
};

export default function OperationCard({ operation, checked, onToggle, children }) {
  const { label, description } = describeOperation(operation);
  const Icon = OPERATION_ICONS[operation.type] ?? PlanIcon;
  const checkboxId = `operation-${operation.id}`;

  return (
    <div className={`operation-card${checked ? ' is-checked' : ''}`}>
      {onToggle && (
        <input
          id={checkboxId}
          type="checkbox"
          className="operation-card-checkbox"
          checked={checked}
          onChange={onToggle}
        />
      )}
      <div className="operation-card-icon">
        <Icon aria-hidden="true" />
      </div>
      <div className="operation-card-body">
        <label htmlFor={onToggle ? checkboxId : undefined} className="operation-card-title">
          {label}
        </label>
        {description && <p className="operation-card-description">{description}</p>}
        {children}
      </div>
    </div>
  );
}
