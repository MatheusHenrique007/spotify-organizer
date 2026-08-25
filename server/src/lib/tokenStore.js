import fs from 'node:fs';
import { config } from './config.js';
import { encrypt, decrypt } from './crypto.js';

function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

export function saveTokens(tokens) {
  ensureDataDir();
  const payload = encrypt(JSON.stringify(tokens), config.tokenEncryptionKey);
  fs.writeFileSync(config.tokensFile, JSON.stringify(payload, null, 2), 'utf8');
}

export function loadTokens() {
  if (!fs.existsSync(config.tokensFile)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(config.tokensFile, 'utf8'));
    const json = decrypt(payload, config.tokenEncryptionKey);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function clearTokens() {
  if (fs.existsSync(config.tokensFile)) {
    fs.unlinkSync(config.tokensFile);
  }
}
