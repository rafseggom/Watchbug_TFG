#!/usr/bin/env node
/**
 * One-shot fixture generator (not part of the build or verify pipeline):
 * draws a deterministic 64×64 two-tone canvas in chromium and exports both
 * fixtures with the browser's own encoders.
 *
 *   e2e/fixtures/valid-64x64.png  — PNG via canvas.toBlob('image/png')
 *   e2e/fixtures/valid-64x64.webp — WebP via canvas.toBlob('image/webp')
 *     (chromium encodes WebP natively; the webkit project in `npm run verify`
 *      exercises the runtime fallback path against this same fixture)
 *   e2e/fixtures/valid-64x64.jpg  — JPEG via canvas.toBlob('image/jpeg')
 *     (the P3-D-14 server lane; asserted `blob.type === 'image/jpeg'` the same
 *      way as the WebP branch before the bytes are written)
 *   e2e/fixtures/oversize-64mp.jpg — a real 64×64 JPEG whose SOFn marker is
 *     RE-declared as 8000×8192 (65,536,000 px > MAX_IMAGE_PIXELS). The decode-
 *     bomb guard reads only the header, so the synthetic-SOF route (PLAN, Task
 *     2: "keep the script browser-only") produces exactly the hostile shape a
 *     small file declaring a huge canvas has — no 64 MP browser canvas needed.
 *   e2e/fixtures/rotated-exif-80x40.jpg — an 80×40 canvas JPEG with an APP1
 *     `Exif` segment (Orientation = 6, "rotate 90° CW to display") inserted
 *     immediately after the SOI marker. The P3-D-14 orientation lane: after
 *     autoOrient + re-encode the STORED frame must be 40×80 with no Exif
 *     segment left.
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'fixtures');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

const pngBase64 = await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f6feb';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 8, 48, 48);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const buf = await blob.arrayBuffer();
  let binary = '';
  new Uint8Array(buf).forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
});

const webpBase64 = await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f6feb';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 8, 48, 48);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp'));
  if (blob.type !== 'image/webp') throw new Error(`expected image/webp, got ${blob.type}`);
  const buf = await blob.arrayBuffer();
  let binary = '';
  new Uint8Array(buf).forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
});

const jpegBase64 = await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f6feb';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 8, 48, 48);
  // quality 0.9: the fixture is submitted input, not a stored artifact — the
  // harden stage re-encodes at its own explicit quality regardless.
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (blob.type !== 'image/jpeg') throw new Error(`expected image/jpeg, got ${blob.type}`);
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // The 3-byte SOI+marker prefix the server sniffer keys on (research F1):
  // a 4-byte JFIF check would reject libvips' own output, so assert the
  // fixture at least carries the prefix the lane accepts.
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    throw new Error(`fixture does not start with the JPEG magic prefix FF D8 FF`);
  }
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
});

const oversizeBase64 = await page.evaluate(async () => {
  // Encode the same two-tone 64×64 canvas, then re-declare the SOFn frame as
  // 8000×8192. A real 64 MP browser canvas is memory-bound and flaky; the
  // decode-bomb guard never decodes — it reads ONLY the header — so a
  // SOF-patched ordinary JPEG is the faithful hostile shape (PLAN Task 2
  // sanctions the synthetic-SOF route with exactly this note).
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f6feb';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 8, 48, 48);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (blob.type !== 'image/jpeg') throw new Error(`expected image/jpeg, got ${blob.type}`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    throw new Error('fixture does not start with the JPEG magic prefix FF D8 FF');
  }
  // Walk to the first SOFn the same way the server guard does: standalone
  // markers carry no length; everything else is an explicit segment.
  let off = 2;
  while (off + 4 <= bytes.length) {
    if (bytes[off] !== 0xff) throw new Error('marker walk desynced');
    const marker = bytes[off + 1];
    if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;
      continue;
    }
    const length = (bytes[off + 2] << 8) | bytes[off + 3];
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      // [precision:1][height:2 BE][width:2 BE] after the length field.
      bytes[off + 5] = 0x1f; bytes[off + 6] = 0x40; // height 8000 (≤ MAX_IMAGE_DIM)
      bytes[off + 7] = 0x20; bytes[off + 8] = 0x00; // width  8192 (≤ MAX_IMAGE_DIM)
      // 65,536,000 px — over MAX_IMAGE_PIXELS on a file that stays tiny.
      let binary = '';
      bytes.forEach((b) => { binary += String.fromCharCode(b); });
      return btoa(binary);
    }
    off += 2 + length;
  }
  throw new Error('no SOF marker found in the encoded JPEG');
});

const rotatedBase64 = await page.evaluate(async () => {
  // An 80×40 raw frame carrying EXIF Orientation = 6: the reporter SAW a
  // 40×80 portrait (rotate 90° clockwise on display). This is the fixture
  // that proves `autoOrient: true` runs — without it sharp stores the
  // sideways 80×40 raw order and its default metadata strip removes the tag,
  // making the intended orientation unrecoverable (research Pitfall 9).
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f6feb';
  ctx.fillRect(0, 0, 80, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4, 4, 72, 32);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (blob.type !== 'image/jpeg') throw new Error(`expected image/jpeg, got ${blob.type}`);
  const src = new Uint8Array(await blob.arrayBuffer());

  // APP1 Exif segment: length + "Exif\0\0" + a little-endian TIFF holding
  // exactly one IFD0 entry — tag 0x0112 (Orientation), type SHORT, value 6.
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, // "II" + magic 42
    0x08, 0x00, 0x00, 0x00, // IFD0 sits right after the 8-byte TIFF header
    0x01, 0x00, // one directory entry
    0x12, 0x01, // tag   0x0112 = Orientation
    0x03, 0x00, // type  SHORT
    0x01, 0x00, 0x00, 0x00, // count 1
    0x06, 0x00, 0x00, 0x00, // value 6 (rotate 90° CW), zero-padded to 4 bytes
    0x00, 0x00, 0x00, 0x00, // next IFD: none
  ];
  const segLen = 2 + exifHeader.length + tiff.length; // the length field counts itself
  const app1 = [0xff, 0xe1, (segLen >> 8) & 0xff, segLen & 0xff, ...exifHeader, ...tiff];

  // Insert immediately after SOI (PLAN Task 3).
  const bytes = new Uint8Array(src.length + app1.length);
  bytes.set(src.subarray(0, 2), 0);
  bytes.set(app1, 2);
  bytes.set(src.subarray(2), 2 + app1.length);

  // The script-level assertions the plan mandates: the produced bytes carry
  // the Exif segment and still begin with the JPEG magic prefix.
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    throw new Error('fixture no longer starts with the JPEG magic prefix');
  }
  const asLatin1 = Array.from(bytes.slice(0, 2 + app1.length))
    .map((x) => String.fromCharCode(x))
    .join('');
  if (!asLatin1.includes('Exif')) throw new Error('APP1 Exif segment missing from the fixture');
  if (!(bytes[2] === 0xff && bytes[3] === 0xe1)) throw new Error('APP1 marker was not placed right after SOI');

  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
});

await browser.close();

writeFileSync(join(outDir, 'valid-64x64.png'), Buffer.from(pngBase64, 'base64'));
writeFileSync(join(outDir, 'valid-64x64.webp'), Buffer.from(webpBase64, 'base64'));
writeFileSync(join(outDir, 'valid-64x64.jpg'), Buffer.from(jpegBase64, 'base64'));
writeFileSync(join(outDir, 'oversize-64mp.jpg'), Buffer.from(oversizeBase64, 'base64'));
writeFileSync(join(outDir, 'rotated-exif-80x40.jpg'), Buffer.from(rotatedBase64, 'base64'));
console.log(`fixtures written to ${outDir}`);
