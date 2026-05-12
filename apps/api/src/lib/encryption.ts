import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;

function getMasterKey(): Buffer {
  const raw = process.env.MASTER_ENCRYPTION_KEY;
  if (!raw) throw new Error('MASTER_ENCRYPTION_KEY missing');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  // fallback: derive from passphrase deterministically
  return scryptSync(raw, 'stone-gate-salt-v1', KEY_LEN);
}

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export function encrypt(plain: string | Buffer): EncryptedPayload {
  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const buf = typeof plain === 'string' ? Buffer.from(plain, 'utf8') : plain;
  const ciphertext = Buffer.concat([cipher.update(buf), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decrypt(p: EncryptedPayload): Buffer {
  const key = getMasterKey();
  const decipher = createDecipheriv(ALGO, key, p.iv);
  decipher.setAuthTag(p.authTag);
  return Buffer.concat([decipher.update(p.ciphertext), decipher.final()]);
}

export function decryptString(p: EncryptedPayload): string {
  return decrypt(p).toString('utf8');
}
