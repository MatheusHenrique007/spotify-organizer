// Pure derivation of what the status card should show, given a /api/spicetify/status
// response. Kept side-effect-free and framework-free so it's testable without jsdom.
export function describeSpicetifyStatus(status) {
  if (!status) {
    return { spicetify: 'unknown', spotify: 'unknown', backup: 'unknown', message: null };
  }

  const spicetify = status.installed ? 'ok' : 'missing';
  const spotify = status.spotifyInstalled ? (status.spotifyRunning ? 'running' : 'closed') : 'missing';

  let backup = 'unknown';
  let message = null;
  if (!status.backupAvailable) {
    backup = 'missing';
    message = 'Nenhum backup do Spicetify encontrado. Crie um backup antes de aplicar um tema.';
  } else {
    backup = 'ok';
  }

  if (!status.installed) {
    message = 'Spicetify não foi encontrado nesta máquina.';
  } else if (!status.spotifyInstalled) {
    message = 'Spotify Desktop não foi encontrado.';
  }

  return { spicetify, spotify, backup, message, themeApplied: Boolean(status.themeApplied) };
}

// Maps a failed apply/restore result (from the backend) to a user-facing message.
// Never invents a friendlier story than what the backend actually reported.
export function describeApplyError(error) {
  const code = error?.body?.error;
  const message = error?.body?.message || error?.message;

  switch (code) {
    case 'spotify_running':
      return { code, message, requiresConfirmClose: true };
    case 'backup_incompatible':
      return { code, message, requiresBackupUpdate: true };
    case 'no_backup':
      return { code, message, requiresBackup: true };
    case 'spicetify_not_installed':
      return { code, message };
    case 'image_too_large':
    case 'invalid_image':
    case 'unsupported_image_type':
    case 'invalid_color':
    case 'css_too_large':
      return { code, message };
    case 'operation_in_progress':
      return { code, message };
    default:
      return { code: code || 'unknown_error', message: message || 'Não foi possível aplicar o tema.' };
  }
}
