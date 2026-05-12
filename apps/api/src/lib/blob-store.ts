import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join, isAbsolute, posix } from 'node:path';
import { encrypt, decrypt, type EncryptedPayload } from './encryption.js';

/**
 * Blob storage layout
 * -------------------
 * Files live under BLOB_STORAGE_DIR (absolute, host-side path) as
 *   <ROOT>/<opportunityId>/<sha256>.bin
 *
 * In the DB we store ONLY the relative key (`<opportunityId>/<sha256>.bin`).
 * Each service prepends its own BLOB_STORAGE_DIR. This way the API on the host
 * and the doc-processor inside Docker can both read the same files even though
 * their absolute paths differ.
 */
const RAW_ROOT = process.env.BLOB_STORAGE_DIR ?? './data/blobs';
const ROOT = isAbsolute(RAW_ROOT) ? RAW_ROOT : join(process.cwd(), RAW_ROOT);

export interface StoredBlob {
  storagePath: string; // relative key
  sha256: string;
  sizeBytes: number;
}

function toRelativeKey(opportunityId: string, sha256: string): string {
  // Forward-slash relative key — portable across host/container.
  return posix.join(opportunityId, `${sha256}.bin`);
}

function resolveAbsolute(storagePath: string): string {
  if (isAbsolute(storagePath)) return storagePath; // legacy rows
  return join(ROOT, storagePath);
}

export async function storeBlob(
  opportunityId: string,
  buffer: Buffer,
): Promise<StoredBlob> {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const dir = join(ROOT, opportunityId);
  await mkdir(dir, { recursive: true });

  const absolutePath = join(dir, `${sha256}.bin`);
  const enc = encrypt(buffer);
  // Format: [12B iv][16B authTag][ciphertext]
  const out = Buffer.concat([enc.iv, enc.authTag, enc.ciphertext]);
  await writeFile(absolutePath, out);

  return {
    storagePath: toRelativeKey(opportunityId, sha256),
    sha256,
    sizeBytes: buffer.length,
  };
}

export async function readBlob(storagePath: string): Promise<Buffer> {
  const data = await readFile(resolveAbsolute(storagePath));
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  return decrypt({ iv, authTag, ciphertext } as EncryptedPayload);
}

export async function blobMeta(storagePath: string) {
  return stat(resolveAbsolute(storagePath));
}
