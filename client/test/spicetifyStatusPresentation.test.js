import { describe, it, expect } from 'vitest';
import { describeSpicetifyStatus, describeApplyError } from '../src/lib/spicetifyStatusPresentation.js';

describe('describeSpicetifyStatus', () => {
  it('reports unknown state when status has not loaded yet', () => {
    const info = describeSpicetifyStatus(null);
    expect(info).toEqual({ spicetify: 'unknown', spotify: 'unknown', backup: 'unknown', message: null });
  });

  it('reports ok/running/ok for a healthy, fully-detected install', () => {
    const info = describeSpicetifyStatus({
      installed: true,
      spotifyInstalled: true,
      spotifyRunning: true,
      backupAvailable: true,
      themeApplied: true
    });
    expect(info.spicetify).toBe('ok');
    expect(info.spotify).toBe('running');
    expect(info.backup).toBe('ok');
    expect(info.message).toBeNull();
    expect(info.themeApplied).toBe(true);
  });

  it('surfaces a real warning message when no backup exists, instead of claiming everything is fine', () => {
    const info = describeSpicetifyStatus({ installed: true, spotifyInstalled: true, spotifyRunning: false, backupAvailable: false });
    expect(info.backup).toBe('missing');
    expect(info.message).toMatch(/backup/i);
  });

  it('reports missing spicetify with an explicit message, never silently passing', () => {
    const info = describeSpicetifyStatus({ installed: false, spotifyInstalled: true, spotifyRunning: false, backupAvailable: false });
    expect(info.spicetify).toBe('missing');
    expect(info.message).toMatch(/Spicetify não foi encontrado/);
  });
});

describe('describeApplyError', () => {
  it('flags spotify_running as requiring a close confirmation', () => {
    const error = { body: { error: 'spotify_running', message: 'Spotify está aberto.' } };
    const info = describeApplyError(error);
    expect(info.code).toBe('spotify_running');
    expect(info.requiresConfirmClose).toBe(true);
  });

  it('flags backup_incompatible as requiring a backup update', () => {
    const error = { body: { error: 'backup_incompatible', message: 'Backup desatualizado.' } };
    const info = describeApplyError(error);
    expect(info.requiresBackupUpdate).toBe(true);
  });

  it('never claims success for an unrecognized error code — falls back to the real message', () => {
    const error = { message: 'boom', body: null };
    const info = describeApplyError(error);
    expect(info.code).toBe('unknown_error');
    expect(info.message).toBe('boom');
  });
});
