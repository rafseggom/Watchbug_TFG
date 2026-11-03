import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  readClientImageDimensions,
  sniffClientImage,
} from '@watchbug/sdk/capture/manual-file.ts';

/**
 * S-5: the attachment adapter refuses an oversized file from its **header**
 * before `createImageBitmap` materialises the bitmap. These rows exercise the
 * pure header reader against the same fixtures the server lane uses.
 */

const repoRoot = resolve(__dirname, '../..');
const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(resolve(repoRoot, 'e2e/fixtures', name)));

describe('unit: client attachment header gate (S-5)', () => {
  it('classifies PNG, WebP and JPEG by their magic prefix', () => {
    expect(sniffClientImage(fixture('valid-64x64.png'))).toBe('png');
    expect(sniffClientImage(fixture('valid-64x64.webp'))).toBe('webp');
    expect(sniffClientImage(fixture('valid-64x64.jpg'))).toBe('jpeg');
    expect(sniffClientImage(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
  });

  it('reads the declared dimensions from each container header', () => {
    expect(readClientImageDimensions(fixture('valid-64x64.png'), 'png')).toEqual({
      width: 64,
      height: 64,
    });
    expect(readClientImageDimensions(fixture('valid-64x64.webp'), 'webp')).toEqual({
      width: 64,
      height: 64,
    });
    // The rotated fixture is an 80×40 raw frame (Orientation is applied later
    // by the decoder, so the header still says 80×40).
    expect(readClientImageDimensions(fixture('rotated-exif-80x40.jpg'), 'jpeg')).toEqual({
      width: 80,
      height: 40,
    });
  });

  it('refuses a truncated header instead of guessing', () => {
    expect(readClientImageDimensions(fixture('valid-64x64.png').subarray(0, 12), 'png')).toBeNull();
    expect(readClientImageDimensions(fixture('valid-64x64.jpg').subarray(0, 2), 'jpeg')).toBeNull();
    expect(readClientImageDimensions(fixture('valid-64x64.webp').subarray(0, 12), 'webp')).toBeNull();
  });
});
