export function describeExecutionDetails(details) {
  if (!details) return null;

  const attempts = typeof details.attempts === 'number' ? details.attempts : null;
  const attemptsLabel = attempts === null ? null : `${attempts} tentativa${attempts === 1 ? '' : 's'}`;

  const retryLabel = details.retryPerformed ? 'retry realizado' : 'sem retry';

  const verificationLabel =
    details.verificationPassed === true
      ? 'Verificação: confirmada'
      : details.verificationPassed === false
        ? 'Verificação: falhou'
        : null;

  const verificationClass =
    details.verificationPassed === true
      ? 'status-success'
      : details.verificationPassed === false
        ? 'status-error'
        : null;

  const snapshotCount = Array.isArray(details.snapshotsUsed) ? details.snapshotsUsed.length : null;
  const snapshotsLabel = snapshotCount === null ? null : `Snapshots utilizados: ${snapshotCount}`;

  const uriCount = Array.isArray(details.uris) ? details.uris.length : null;

  return {
    summary: [attemptsLabel, retryLabel].filter(Boolean).join(' · '),
    verificationLabel,
    verificationClass,
    snapshotsLabel,
    attempts,
    retryPerformed: Boolean(details.retryPerformed),
    verificationPassed: details.verificationPassed,
    snapshotCount,
    uriCount,
    uris: Array.isArray(details.uris) ? details.uris : []
  };
}
