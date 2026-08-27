export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="state-block">
      {Icon && (
        <div className="state-block-icon">
          <Icon size={32} aria-hidden="true" />
        </div>
      )}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
