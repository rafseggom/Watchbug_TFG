import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import type { ImageExt } from '@watchbug/contracts/types';
import { STORAGE_KEY_REGEX, type Storage } from '../ports';

/**
 * Filesystem `Storage` adapter (R-02 seam #6, C-4).
 *
 * - **Keys are server-generated**: `randomUUID()` — a client-supplied name
 *   never reaches `path.*` (the traversal hole R-04 forbids).
 * - **Layout:** `<volume>/blobs/<projectId>/<shard>/<uuid>.<ext>` with in-flight
 *   writes at `<volume>/tmp/<uuid>.part` → `fsync` → `rename()` (atomic on
 *   POSIX volumes; a crash leaves either nothing or a complete blob, never a
 *   partial one).
 * - **Belt and braces:** every path is `path.resolve`-d and asserted to stay
 *   under the volume root, *and* the key grammar is validated first — two
 *   independent checks between a stored key and the filesystem.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class FsStorageError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'FsStorageError';
  }
}

export class FsStorage implements Storage {
  private readonly root: string;

  constructor(volumeRoot: string) {
    this.root = resolve(volumeRoot);
  }

  /** Validated absolute path — throws unless the key is grammatical and inside the volume. */
  private pathFor(key: string): string {
    if (!STORAGE_KEY_REGEX.test(key)) {
      // Never echo the offending value: this is server state, not user input.
      throw new FsStorageError('stored object key is malformed', 404);
    }
    const abs = resolve(this.root, key);
    if (!abs.startsWith(this.root + sep)) {
      throw new FsStorageError('stored object key escapes the volume root', 404);
    }
    return abs;
  }

  async put(bytes: Uint8Array, ext: ImageExt, projectId: string): Promise<{ key: string }> {
    if (!UUID_RE.test(projectId)) {
      throw new FsStorageError('projectId is not a uuid', 500);
    }

    const id = randomUUID();
    const shard = id.slice(0, 2);
    const key = `${projectId}/${shard}/${id}.${ext}`;
    const target = this.pathFor(key);

    const tmpDir = resolve(this.root, 'tmp');
    const tmpPath = resolve(tmpDir, `${id}.part`);
    if (!tmpPath.startsWith(this.root + sep)) {
      throw new FsStorageError('temp path escapes the volume root', 500);
    }

    await mkdir(tmpDir, { recursive: true });
    await mkdir(dirname(target), { recursive: true });

    const handle = await open(tmpPath, 'wx');
    try {
      await handle.writeFile(bytes);
      await handle.sync(); // durability before the name becomes visible
    } finally {
      await handle.close();
    }

    try {
      await rename(tmpPath, target);
    } catch (err) {
      await rm(tmpPath, { force: true }); // no orphaned partial writes
      throw err;
    }

    return { key };
  }

  async stream(key: string): Promise<Readable> {
    const abs = this.pathFor(key);
    try {
      const info = await stat(abs);
      if (!info.isFile()) throw new FsStorageError('stored object is not a regular file', 404);
    } catch (err) {
      if (err instanceof FsStorageError) throw err;
      throw new FsStorageError('stored object not found', 404);
    }
    return createReadStream(abs);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
