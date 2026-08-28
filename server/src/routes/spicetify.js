import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { detectSpicetifyStatus } from '../lib/spicetify/detect.js';
import { generateTheme, readCurrentThemeConfig, saveCurrentThemeConfig } from '../lib/spicetify/themeManager.js';
import { runApply, runRestore, runBackup, runBackupApply, currentOperation, closeSpotifyAndWait } from '../lib/spicetify/runner.js';
import { SpicetifyError } from '../lib/spicetify/errors.js';
import { addHistoryEntry } from '../lib/historyStore.js';

export const spicetifyRouter = Router();

function handleSpicetifyError(res, error) {
  if (error instanceof SpicetifyError) {
    return res.status(409).json({ error: error.code, message: error.message, details: error.details });
  }
  throw error;
}

spicetifyRouter.get('/status', asyncHandler(async (req, res) => {
  const status = await detectSpicetifyStatus();
  res.json({ ...status, operationInProgress: currentOperation(), savedThemeConfig: readCurrentThemeConfig() });
}));

spicetifyRouter.post('/theme', asyncHandler(async (req, res) => {
  const { colors, backgroundDataUri, overlayOpacity, blurPx } = req.body || {};
  try {
    const result = generateTheme({ colors, backgroundDataUri, overlayOpacity, blurPx });
    saveCurrentThemeConfig({ colors, backgroundDataUri, overlayOpacity, blurPx, updatedAt: new Date().toISOString() });
    res.json({ ok: true, ...result });
  } catch (error) {
    return handleSpicetifyError(res, error);
  }
}));

spicetifyRouter.post('/apply', asyncHandler(async (req, res) => {
  const status = await detectSpicetifyStatus();
  if (!status.installed) {
    return res.status(409).json({ error: 'spicetify_not_installed', message: 'Spicetify não foi encontrado nesta máquina.' });
  }
  if (status.spotifyRunning && !req.body?.confirmClose) {
    return res.status(409).json({
      error: 'spotify_running',
      message: 'Spotify está aberto. Feche o Spotify para aplicar esta alteração.',
      requiresConfirmation: 'confirmClose'
    });
  }

  try {
    if (status.spotifyRunning && req.body?.confirmClose) {
      await closeSpotifyAndWait();
    }
    const result = await runApply();
    const entry = addHistoryEntry({
      type: 'spicetify_theme',
      target: 'spotify_desktop',
      action: 'apply',
      result: result.exitCode === 0 && !result.versionMismatch ? 'success' : 'failure',
      details: { exitCode: result.exitCode, versionMismatch: result.versionMismatch, stdout: result.stdout, stderr: result.stderr }
    });
    if (result.versionMismatch) {
      return res.status(409).json({
        error: 'backup_incompatible',
        message: 'Spotify foi atualizado. O backup do Spicetify precisa ser regenerado (backup apply) antes de aplicar.',
        result,
        historyEntry: entry
      });
    }
    res.json({ ok: result.exitCode === 0, result, historyEntry: entry });
  } catch (error) {
    return handleSpicetifyError(res, error);
  }
}));

spicetifyRouter.post('/restore', asyncHandler(async (req, res) => {
  const status = await detectSpicetifyStatus();
  if (!status.installed) {
    return res.status(409).json({ error: 'spicetify_not_installed', message: 'Spicetify não foi encontrado nesta máquina.' });
  }
  if (!status.backupAvailable) {
    return res.status(409).json({ error: 'no_backup', message: 'Nenhum backup do Spicetify foi encontrado.' });
  }
  if (status.spotifyRunning && !req.body?.confirmClose) {
    return res.status(409).json({
      error: 'spotify_running',
      message: 'Spotify está aberto. Feche o Spotify para restaurar.',
      requiresConfirmation: 'confirmClose'
    });
  }

  try {
    if (status.spotifyRunning && req.body?.confirmClose) {
      await closeSpotifyAndWait();
    }
    const result = await runRestore();
    const entry = addHistoryEntry({
      type: 'spicetify_theme',
      target: 'spotify_desktop',
      action: 'restore',
      result: result.exitCode === 0 && !result.versionMismatch ? 'success' : 'failure',
      details: { exitCode: result.exitCode, versionMismatch: result.versionMismatch, stdout: result.stdout, stderr: result.stderr }
    });
    if (result.versionMismatch) {
      return res.status(409).json({
        error: 'backup_incompatible',
        message: 'Backup incompatível com a versão atual do Spotify. Rode "Atualizar backup" e tente novamente.',
        result,
        historyEntry: entry
      });
    }
    res.json({ ok: result.exitCode === 0, result, historyEntry: entry });
  } catch (error) {
    return handleSpicetifyError(res, error);
  }
}));

spicetifyRouter.post('/backup', asyncHandler(async (req, res) => {
  try {
    const useBackupApply = Boolean(req.body?.regenerate);
    const result = useBackupApply ? await runBackupApply() : await runBackup();
    const entry = addHistoryEntry({
      type: 'spicetify_theme',
      target: 'spotify_desktop',
      action: useBackupApply ? 'backup_apply' : 'backup',
      result: result.exitCode === 0 ? 'success' : 'failure',
      details: { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }
    });
    res.json({ ok: result.exitCode === 0, result, historyEntry: entry });
  } catch (error) {
    return handleSpicetifyError(res, error);
  }
}));
