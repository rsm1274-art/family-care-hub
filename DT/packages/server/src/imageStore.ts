import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from './config';

/**
 * Images live at IMAGES_DIR/<personId>/<random>.jpg on the host filesystem.
 * The DB stores only the filename; access always goes through the
 * authenticated /api/images route which checks household ownership.
 */

function personDir(personId: string): string {
  // personId is always a server-generated UUID, but basename() guards the
  // path join anyway.
  return path.join(config.imagesDir, path.basename(personId));
}

export function saveBase64Image(personId: string, base64: string): string {
  // Accept both bare base64 and data: URLs.
  const stripped = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(stripped, 'base64');
  if (buffer.length === 0) {
    throw new Error('Empty image payload');
  }
  const dir = personDir(personId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.jpg`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return filename;
}

export function imagePath(personId: string, filename: string): string {
  return path.join(personDir(personId), path.basename(filename));
}

export function deleteImage(personId: string, filename: string | null): void {
  if (!filename) return;
  try {
    fs.unlinkSync(imagePath(personId, filename));
  } catch {
    // Already gone — nothing to do.
  }
}

export function deletePersonImages(personId: string): void {
  fs.rmSync(personDir(personId), { recursive: true, force: true });
}
