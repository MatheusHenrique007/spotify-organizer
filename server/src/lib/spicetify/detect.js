import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { config } from '../config.js';

function run(exePath, args) {
  return new Promise((resolve) => {
    execFile(exePath, args, { timeout: 10_000 }, (error, stdout, stderr) => {
      resolve({ error, stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
    });
  });
}

function parseIni(content) {
  const result = {};
  let section = null;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      result[section] = {};
      continue;
    }
    const kv = line.match(/^([^=]+)=(.*)$/);
    if (kv && section) {
      result[section][kv[1].trim()] = kv[2].trim();
    }
  }
  return result;
}

function isSpotifyRunning() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq Spotify.exe', '/FO', 'CSV', '/NH'], { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve(false);
      resolve((stdout || '').toLowerCase().includes('spotify.exe'));
    });
  });
}

export async function detectSpicetifyStatus() {
  const status = {
    installed: false,
    version: null,
    spotifyInstalled: false,
    spotifyRunning: false,
    backupAvailable: false,
    backupVersion: null,
    currentSpotifyVersion: null,
    backupCompatible: null,
    currentTheme: null,
    themeApplied: false
  };

  status.installed = fs.existsSync(config.spicetify.exePath);
  if (status.installed) {
    const { error, stdout } = await run(config.spicetify.exePath, ['-v']);
    if (!error) {
      const match = stdout.match(/\d+\.\d+\.\d+/);
      status.version = match ? match[0] : stdout.trim() || null;
    }
  }

  status.spotifyRunning = await isSpotifyRunning();

  let cfg = {};
  if (fs.existsSync(config.spicetify.configFile)) {
    const raw = fs.readFileSync(config.spicetify.configFile, 'utf8');
    cfg = parseIni(raw);
    const spotifyPath = cfg.Setting?.spotify_path;
    status.spotifyInstalled = Boolean(spotifyPath && fs.existsSync(path.join(spotifyPath, 'Spotify.exe')));
    status.currentTheme = cfg.Setting?.current_theme || null;
    status.backupVersion = cfg.Backup?.version || null;
  }

  const loginBackup = path.join(config.spicetify.backupDir, 'login.spa');
  const xpuiBackup = path.join(config.spicetify.backupDir, 'xpui.spa');
  status.backupAvailable = fs.existsSync(loginBackup) && fs.existsSync(xpuiBackup);

  const themeDir = path.join(config.spicetify.themesDir, config.spicetify.themeName);
  status.themeApplied = status.currentTheme === config.spicetify.themeName;
  status.themeExists = fs.existsSync(path.join(themeDir, 'color.ini')) && fs.existsSync(path.join(themeDir, 'user.css'));

  return status;
}
