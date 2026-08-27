export function PlaylistGridSkeleton({ count = 8 }) {
  return (
    <div className="skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-card">
          <div className="skeleton skeleton-cover" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
        </div>
      ))}
    </div>
  );
}

export default function LoadingSpinner({ label = 'Loading...' }) {
  return (
    <div className="loading" role="status">
      {label}
    </div>
  );
}
