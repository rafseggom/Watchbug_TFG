import type { Readable } from 'node:stream';
import type { ImageExt } from '@watchbug/contracts/types';

/**
 * The `Storage` seam (R-02 fixes exactly 8 seams — this is seam #6).
 *
 * **Keys are always server-generated**: a `put()` that accepted a client name
 * would express the path-traversal hole R-04 forbids, so that input does not
 * exist in this interface. Grammar (C-4):
 *
 *   `<projectId 36>/<shard 2>/<uuid 36>.(webp|png|jpeg)`
 *
 * Note the `projectId` segment: the on-disk layout (`blobs/<projectId>/…`)
 * mandates it, so `put` takes it as an argument even though the port sketch in
 * research wrote it as `put(bytes, ext)` — see SUMMARY (deviation).
 */
export interface Storage {
  put(bytes: Uint8Array, ext: ImageExt, projectId: string): Promise<{ key: string }>;
  stream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}

/** The only key shape this server will ever read or write (validated before any path use). */
export const STORAGE_KEY_REGEX = /^[0-9a-f-]{36}\/[a-f0-9]{2}\/[0-9a-f-]{36}\.(webp|png|jpeg)$/;

/** Server-owned image extensions — PNG, WebP and JPEG (P3-D-14 widens P1-D-11). */
export const IMAGE_EXTENSIONS: readonly ImageExt[] = ['png', 'webp', 'jpeg'];

export function isImageExt(value: string): value is ImageExt {
  return value === 'png' || value === 'webp' || value === 'jpeg';
}
