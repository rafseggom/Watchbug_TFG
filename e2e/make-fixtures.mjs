#!/usr/bin/env node
/**
 * One-shot fixture generator (not part of the build or verify pipeline):
 * draws deterministic canvases in chromium and exports the fixtures with the
 * browser's own encoders.
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

const fixtures = await page.evaluate(async () => {
  /** The shared two-tone fixture paint. */
  const paint = (canvas, width, height, margin = 8) => {
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('fixture canvas has no 2D context');
    ctx.fillStyle = '#2f6feb';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(margin, margin, width - margin * 2, height - margin * 2);
  };

  const encode = async (width, height, mime, quality, margin) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas, width, height, margin);
    const blob = await new Promise((resolveBlob) => canvas.toBlob(resolveBlob, mime, quality));
    if (blob === null) throw new Error(`canvas.toBlob returned null for ${mime}`);
    if (blob.type !== mime) throw new Error(`expected ${mime}, got ${blob.type}`);
    return new Uint8Array(await blob.arrayBuffer());
  };

  const jpeg = async (width, height, margin) => {
    const bytes = await encode(width, height, 'image/jpeg', 0.9, margin);
    // The 3-byte SOI+marker prefix the server sniffer keys on (research F1):
    // a 4-byte JFIF check would reject libvips' own output, so assert the
    // fixture at least carries the prefix the lane accepts.
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
      throw new Error('fixture does not start with the JPEG magic prefix FF D8 FF');
    }
    return bytes;
  };

  const base64 = (bytes) => {
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  };

  const png = await encode(64, 64, 'image/png');
  const webp = await encode(64, 64, 'image/webp');
  const jpegBytes = await jpeg(64, 64);

  // Encode the same two-tone 64×64 canvas, then re-declare the SOFn frame as
  // 8000×8192. A real 64 MP browser canvas is memory-bound and flaky; the
  // decode-bomb guard never decodes — it reads ONLY the header — so a
  // SOF-patched ordinary JPEG is the faithful hostile shape (PLAN Task 2
  // sanctions the synthetic-SOF route with exactly this note).
  const oversize = new Uint8Array(jpegBytes);
  let off = 2;
  while (off + 4 <= oversize.length) {
    if (oversize[off] !== 0xff) throw new Error('marker walk desynced');
    const marker = oversize[off + 1];
    if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;
      continue;
    }
    const length = (oversize[off + 2] << 8) | oversize[off + 3];
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      // [precision:1][height:2 BE][width:2 BE] after the length field.
      oversize[off + 5] = 0x1f;
      oversize[off + 6] = 0x40; // height 8000 (≤ MAX_IMAGE_DIM)
      oversize[off + 7] = 0x20;
      oversize[off + 8] = 0x00; // width  8192 (≤ MAX_IMAGE_DIM)
      break;
    }
    off += 2 + length;
  }
  if (off + 4 > oversize.length) throw new Error('no SOF marker found in the encoded JPEG');

  // An 80×40 raw frame carrying EXIF Orientation = 6: the reporter SAW a
  // 40×80 portrait (rotate 90° clockwise on display). This is the fixture
  // that proves `autoOrient: true` runs — without it sharp stores the
  // sideways 80×40 raw order and its default metadata strip removes the tag,
  // making the intended orientation unrecoverable (research Pitfall 9).
  const rotatedSource = await jpeg(80, 40, 4);
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

  const rotated = new Uint8Array(rotatedSource.length + app1.length);
  rotated.set(rotatedSource.subarray(0, 2), 0);
  rotated.set(app1, 2);
  rotated.set(rotatedSource.subarray(2), 2 + app1.length);

  // The script-level assertions the plan mandates: the produced bytes carry
  // the Exif segment and still begin with the JPEG magic prefix.
  if (!(rotated[0] === 0xff && rotated[1] === 0xd8 && rotated[2] === 0xff)) {
    throw new Error('fixture no longer starts with the JPEG magic prefix');
  }
  const asLatin1 = Array.from(rotated.slice(0, 2 + app1.length))
    .map((x) => String.fromCharCode(x))
    .join('');
  if (!asLatin1.includes('Exif')) throw new Error('APP1 Exif segment missing from the fixture');
  if (!(rotated[2] === 0xff && rotated[3] === 0xe1)) {
    throw new Error('APP1 marker was not placed right after SOI');
  }

  return {
    png: base64(png),
    webp: base64(webp),
    jpeg: base64(jpegBytes),
    oversize: base64(oversize),
    rotated: base64(rotated),
  };
});

await browser.close();

writeFileSync(join(outDir, 'valid-64x64.png'), Buffer.from(fixtures.png, 'base64'));
writeFileSync(join(outDir, 'valid-64x64.webp'), Buffer.from(fixtures.webp, 'base64'));
writeFileSync(join(outDir, 'valid-64x64.jpg'), Buffer.from(fixtures.jpeg, 'base64'));
writeFileSync(join(outDir, 'oversize-64mp.jpg'), Buffer.from(fixtures.oversize, 'base64'));
writeFileSync(join(outDir, 'rotated-exif-80x40.jpg'), Buffer.from(fixtures.rotated, 'base64'));
console.log(`fixtures written to ${outDir}`);
