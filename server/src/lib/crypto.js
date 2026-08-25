import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const SALT = 'spotify-organizer-static-salt-v1';
const KEY_LEN = 32;

function deriveKey(passphrase) {
  return crypto.scryptSync(passphrase, SALT, KEY_LEN);
}

export function encrypt(plaintext, passphrase) {
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted.toString('base64')
  };
}

export function decrypt(payload, passphrase) {
  const key = deriveKey(passphrase);
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

export function generateCodeVerifier() {
  return crypto.randomBytes(64).toString('base64url');
}

export function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function generateState() {
  return crypto.randomBytes(16).toString('hex');
}
