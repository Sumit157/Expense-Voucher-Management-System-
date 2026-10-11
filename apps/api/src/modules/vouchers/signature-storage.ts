import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Signature images (D-008 / SECURITY.md): 2 MB max, PNG/JPEG/WebP only,
 * content-sniffed from magic bytes — never trusting extension or the
 * client-declared MIME type. Bytes live under a private directory that is
 * never served statically; reads go through authorised API routes only.
 */

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const ALLOWED_SIGNATURE_MIME_TYPES = Object.keys(ALLOWED_MIME_TO_EXT);

export function sniffImageMime(buffer: Buffer): string | null {
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= PNG.length && PNG.every((byte, i) => buffer[i] === byte)) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export interface SavedFile {
  storageKey: string;
  sha256: string;
}

export interface SignatureStorage {
  readonly rootDir: string;
  save(buffer: Buffer, mimeType: string): Promise<SavedFile>;
  read(storageKey: string): Promise<Buffer | null>;
  remove(storageKey: string): Promise<void>;
}

export function resolveUploadDir(repoRoot: string, uploadDir: string): string {
  return path.isAbsolute(uploadDir) ? uploadDir : path.resolve(repoRoot, uploadDir);
}

export function createSignatureStorage(rootDir: string): SignatureStorage {
  function resolveKey(storageKey: string): string {
    const full = path.resolve(rootDir, storageKey);
    // storage keys are server-generated, but never allow a key to escape
    // the private directory even if the database were tampered with.
    if (full !== rootDir && !full.startsWith(rootDir + path.sep)) {
      throw new Error('invalid storage key');
    }
    return full;
  }

  return {
    rootDir,
    async save(buffer, mimeType) {
      const ext = ALLOWED_MIME_TO_EXT[mimeType];
      if (!ext) {
        throw new Error('unsupported mime type');
      }
      const storageKey = `sig-${randomUUID()}.${ext}`;
      await fs.mkdir(rootDir, { recursive: true });
      await fs.writeFile(resolveKey(storageKey), buffer, { flag: 'wx' });
      return { storageKey, sha256: createHash('sha256').update(buffer).digest('hex') };
    },
    async read(storageKey) {
      try {
        return await fs.readFile(resolveKey(storageKey));
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    },
    async remove(storageKey) {
      try {
        await fs.unlink(resolveKey(storageKey));
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') {
          throw error;
        }
      }
    },
  };
}
