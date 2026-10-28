import type { Page } from '@playwright/test';

/**
 * Editor harness (03-05): the walk vocabulary the annotation rows share.
 *
 * **The canvas→viewport mapping here is written INDEPENDENTLY of the SDK's
 * `redact/geometry.ts`** — the same discipline `readMaskRect` brought to the
 * CA-02 rows (PATTERNS § "e2e/helpers/editor.ts"): the assertion must not
 * import the code under test, or a wrong geometry authority would validate
 * its own mistake and every ink assertion would pass vacuously. If the SDK
 * mapping and this one ever disagree, ink lands where the row cannot see it
 * and the rows fail — which is exactly the point.
 *
 * Reads pierce the OPEN-mode shadow root (R-14); drags run through the real
 * `page.mouse` (trusted pointer events, assumption A2).
 */

/** The launcher accent `#2f6feb` — the ink source (P3-D-07, host token). */
const INK_RGB: readonly [number, number, number] = [0x2f, 0x6f, 0xeb];
/**
 * Squared-distance tolerance — the plan's own wording ("squared distance to
 * #2f6feb"). The stub frame's palette is the noise floor: its nearest colour
 * is the teal block `#0b7285` at d² = 11709, so ROWS must pick sampled
 * regions that contain no teal block (the away-box used by the ANN rows sits
 * over the navy gradient, d² ≥ ~23k even under encoder noise), while a real
 * stroke's ≥50%-coverage pixels land at d² ≤ ~9500 and count. CAP-04's
 * exact-match probe proves the frame itself carries zero exact accent.
 */
const INK_TOLERANCE_SQ = 14400;

/** Bitmap-space point: `[x, y]` in the DRAFT's own pixels. */
export type BitmapPoint = [number, number];

export interface CanvasBox {
  /** The canvas's own CSS box (viewport coords) — the only mapping input,
   * exactly as in the SDK (Pitfall 7: never the window viewport). */
  left: number;
  top: number;
  width: number;
  height: number;
  /** The backing-store size — the bitmap dimensions. */
  bitmapWidth: number;
  bitmapHeight: number;
}

/**
 * The INDEPENDENT canvas→viewport mapping: `viewport = origin + bitmap *
 * (cssSize / backingSize)` per axis. Mirrors what `transformFor` inverts;
 * deliberately not imported from it (see the file header).
 */
export function canvasToViewport(box: CanvasBox, point: BitmapPoint): { x: number; y: number } {
  return {
    x: box.left + point[0] * (box.width / box.bitmapWidth),
    y: box.top + point[1] * (box.height / box.bitmapHeight),
  };
}

/** Read the editor canvas's live CSS box + backing store. */
export async function canvasBox(page: Page): Promise<CanvasBox> {
  return page.evaluate(() => {
    const canvas = document
      .querySelector('watchbug-host')
      ?.shadowRoot?.querySelector('canvas.editor-canvas') as HTMLCanvasElement | null;
    if (canvas === null) throw new Error('canvasBox: no canvas.editor-canvas (open-mode root)');
    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      bitmapWidth: canvas.width,
      bitmapHeight: canvas.height,
    };
  });
}

/** Wait until the fullscreen editor owns the screen. */
export async function waitForEditor(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      return (
        (root?.querySelector('.wrap')?.getAttribute('data-wb-screen') ?? '') === 'editor' &&
        // The acceptance contract: the editor mounts inside the core-created
        // layer inside `.wrap` — inside the shadow root, never `document.body`.
        root?.querySelector('div.editor-layer > section.editor') !== null
      );
    },
    null,
    { timeout },
  );
}

/** Click `Annotate image` and wait for the editor (the chunk fetch is the row's business). */
export async function openEditor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector('button.composer-annotate') as HTMLButtonElement | null;
    if (button === null) throw new Error('openEditor: no .composer-annotate (open-mode root)');
    if (button.disabled) throw new Error('openEditor: .composer-annotate is disabled');
    button.click();
  });
  await waitForEditor(page);
}

/** Select a rail tool (also proves the rail is `data-wb-tool`-addressable). */
export async function selectTool(
  page: Page,
  tool: 'freehand' | 'arrow' | 'rectangle' | 'text' | 'mask',
): Promise<void> {
  await page.evaluate((which) => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector(
      `button.tool[data-wb-tool="${which}"]`,
    ) as HTMLButtonElement | null;
    if (button === null) throw new Error(`selectTool: no .tool[data-wb-tool=${which}]`);
    button.click();
  }, tool);
}

/** A trusted pointer drag between two BITMAP points, mapped through the canvas box. */
export async function dragOnBitmap(
  page: Page,
  from: BitmapPoint,
  to: BitmapPoint,
  steps = 16,
): Promise<void> {
  const box = await canvasBox(page);
  const p0 = canvasToViewport(box, from);
  const p1 = canvasToViewport(box, to);
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();
  for (let at = 1; at <= steps; at += 1) {
    const fraction = at / steps;
    await page.mouse.move(p0.x + (p1.x - p0.x) * fraction, p0.y + (p1.y - p0.y) * fraction);
  }
  await page.mouse.up();
}

/**
 * The mask drag (03-06): the same trusted pointer walk, named for the tool
 * it drives. Endpoints are BITMAP points of the draft (the editor canvas's
 * own backing-store pixels); the viewport mapping is the INDEPENDENT formula
 * above — `box = canvas.getBoundingClientRect(); scaleX = canvas.width /
 * box.width; viewportX = box.left + bitmapX / scaleX` — never the SDK's
 * `transformFor`. If the SDK's mapping and this one ever disagree, the mask
 * lands where the row's expected rect is not and the CA-02 assertions fail:
 * two derivations, one assertion (non-vacuity).
 */
export async function dragMaskOnBitmap(
  page: Page,
  from: BitmapPoint,
  to: BitmapPoint,
): Promise<void> {
  await dragOnBitmap(page, from, to, 8);
}

export interface BitmapRectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The expected BITMAP rect of a captured CSS-space rect: outward rounding
 * (floor the origin, ceil the extent) against the frame/viewport scale,
 * clamped to the frame — written out independently of `redact/geometry.ts`
 * and byte-for-byte the formula the capture stub used to paint the magenta
 * marker (PAINT_FRAME's floor/ceil mapping), which is what makes a mask row
 * assert on where the marker IS rather than where the SDK guessed it to be.
 */
export function frameBitmapRect(
  rect: BitmapRectLike,
  frame: { width: number; height: number },
  viewport: { width: number; height: number },
): BitmapRectLike {
  const scaleX = frame.width / Math.max(1, viewport.width);
  const scaleY = frame.height / Math.max(1, viewport.height);
  return {
    left: Math.max(0, Math.floor(rect.left * scaleX)),
    top: Math.max(0, Math.floor(rect.top * scaleY)),
    right: Math.min(frame.width, Math.ceil(rect.right * scaleX)),
    bottom: Math.min(frame.height, Math.ceil(rect.bottom * scaleY)),
  };
}

/**
 * Snap a bitmap rect OUTWARD to the pixelation block grid — the independent
 * twin of the SDK's `snapOutward` (03-06 pixelate row): floor left/top, ceil
 * right/bottom to multiples of `blockPx`, grid origin at the bitmap's (0, 0).
 */
export function snapOutwardExpected(
  rect: BitmapRectLike,
  blockPx: number,
): BitmapRectLike {
  return {
    left: Math.floor(rect.left / blockPx) * blockPx,
    top: Math.floor(rect.top / blockPx) * blockPx,
    right: Math.ceil(rect.right / blockPx) * blockPx,
    bottom: Math.ceil(rect.bottom / blockPx) * blockPx,
  };
}

/**
 * The pixelate row's independent block-size oracle: mirrors the SDK's
 * measurement discipline (assign the 15 px label font with the read-back
 * fallback, `measureText('H').actualBoundingBoxAscent`,
 * `max(8, ceil(2 * cap))`) without importing any SDK module. The SAME engine
 * that paints the mask answers this probe, so the grid the row checks is the
 * grid the tool computed, derived twice.
 */
export async function measureBlockSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('measureBlockSize: a 2D canvas is unavailable');
    ctx.font = '15px system-ui, sans-serif';
    if (!ctx.font.includes('15px')) ctx.font = '15px sans-serif';
    const ascent = ctx.measureText('H').actualBoundingBoxAscent;
    const cap = Number.isFinite(ascent) && ascent > 0 ? ascent : 15;
    return Math.max(8, Math.ceil(2 * cap));
  });
}

/** Select the mask style on the `.mask-mode` mini-toggle (03-06, P3-D-10). */
export async function setMaskMode(page: Page, mode: 'fill' | 'pixelate'): Promise<void> {
  await page.evaluate((which) => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector(
      `button.mask-mode-btn[data-wb-mask="${which}"]`,
    ) as HTMLButtonElement | null;
    if (button === null) throw new Error(`setMaskMode: no [data-wb-mask=${which}] button`);
    button.click();
  }, mode);
}

export interface MaskConfirmationState {
  /** The alertdialog is open. */
  visible: boolean;
  /** `role="alertdialog"` on the dialog. */
  role: string;
  /** `aria-modal="true"` on the dialog. */
  ariaModal: string;
  /** Focus currently sits on the `Mask` action button. */
  focusOnAction: boolean;
  /** Focus currently sits on the mask tool button (returned after close). */
  focusOnMaskTool: boolean;
}

/**
 * Read the mask-confirmation dialog state (P3-D-09, T-03-26): visibility,
 * the alertdialog semantics, and where focus sits. Waits for the dialog when
 * `visible` is true; when false it polls until it is gone (or absent).
 */
export async function expectMaskConfirmation(
  page: Page,
  visible: boolean,
  timeout = 5_000,
): Promise<MaskConfirmationState> {
  await page.waitForFunction(
    (want) => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      const dialog = root?.querySelector('div.mask-dialog');
      const shown = dialog?.getAttribute('data-shown') === 'true';
      return want === shown;
    },
    visible,
    { timeout },
  );
  return page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const dialog = root?.querySelector('div.mask-dialog') as HTMLElement | null;
    const action = dialog?.querySelector('button.mask-dialog-action') ?? null;
    const maskTool = root?.querySelector('button.tool[data-wb-tool="mask"]') ?? null;
    const active = root?.activeElement ?? null;
    return {
      visible: dialog?.getAttribute('data-shown') === 'true',
      role: dialog?.getAttribute('role') ?? '',
      ariaModal: dialog?.getAttribute('aria-modal') ?? '',
      focusOnAction: action !== null && active === action,
      focusOnMaskTool: maskTool !== null && active === maskTool,
    };
  });
}

/** Whether the `.mask-mode` toggle is currently visible, and what is pressed. */
export async function maskModeState(
  page: Page,
): Promise<{ visible: boolean; pressed: string }> {
  return page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const group = root?.querySelector('.mask-mode') as HTMLElement | null;
    const shown = group !== null && group.getBoundingClientRect().width > 0;
    const pressed =
      root?.querySelector('button.mask-mode-btn[aria-pressed="true"]')?.getAttribute('data-wb-mask') ??
      '';
    return { visible: shown, pressed };
  });
}

/** Click a mask-confirmation dialog button (`action` = Mask, `cancel` = Not now). */
export async function clickMaskDialogButton(
  page: Page,
  which: 'action' | 'cancel',
): Promise<void> {
  await page.evaluate((kind) => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector(
      `button.mask-dialog-${kind}`,
    ) as HTMLButtonElement | null;
    if (button === null) throw new Error(`clickMaskDialogButton: no .mask-dialog-${kind}`);
    button.click();
  }, which);
}

/** A trusted click at a BITMAP point (text-tool anchoring). */
export async function clickOnBitmap(page: Page, at: BitmapPoint): Promise<void> {
  const box = await canvasBox(page);
  const p = canvasToViewport(box, at);
  await page.mouse.click(p.x, p.y);
}

/** Click the rail `Undo` action. */
export async function undo(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector('button.tool[data-wb-tool="undo"]') as HTMLElement | null;
    if (button === null) throw new Error('undo: no undo rail button');
    button.click();
  });
}

/** Undo through the keyboard path (ANN-06: Ctrl/Cmd+Z matches the button). */
export async function undoKey(page: Page, modifier: 'Control' | 'Meta' = 'Control'): Promise<void> {
  await page.keyboard.press(`${modifier}+z`);
}

/**
 * The text tool's inline label flow (P3-D-08): click the anchor, type, and
 * confirm by `enter` (keyboard path), `outside` (a trusted click on the top
 * bar — blur commits), or `escape` (cancel, commits nothing). No modal: the
 * input is the only element the flow touches.
 */
export async function typeLabel(
  page: Page,
  at: BitmapPoint,
  text: string,
  commit: 'enter' | 'outside' | 'escape' = 'enter',
): Promise<void> {
  await selectTool(page, 'text');
  await clickOnBitmap(page, at);
  await page.waitForFunction(
    () => {
      const input = document
        .querySelector('watchbug-host')
        ?.shadowRoot?.querySelector('input.text-label') as HTMLInputElement | null;
      return input !== null && input.getAttribute('data-shown') === 'true';
    },
    null,
    { timeout: 5_000 },
  );
  if (text.length > 0) await page.keyboard.type(text);
  if (commit === 'enter') {
    await page.keyboard.press('Enter');
  } else if (commit === 'escape') {
    await page.keyboard.press('Escape');
  } else {
    // Click-outside must be TRUSTED: a synthetic click would not blur the
    // focused input and the commit would never fire. Click the bar's title
    // side (never the canvas — the text tool would re-anchor there).
    const bar = await page.evaluate(() => {
      const el = document
        .querySelector('watchbug-host')
        ?.shadowRoot?.querySelector('.editor-bar') as HTMLElement | null;
      if (el === null) throw new Error('typeLabel: no .editor-bar');
      const rect = el.getBoundingClientRect();
      return { x: rect.left + 40, y: rect.top + rect.height / 2 };
    });
    await page.mouse.click(bar.x, bar.y);
  }
  await page.waitForFunction(
    () => {
      const input = document
        .querySelector('watchbug-host')
        ?.shadowRoot?.querySelector('input.text-label') as HTMLInputElement | null;
      return input === null || input.getAttribute('data-shown') !== 'true';
    },
    null,
    { timeout: 5_000 },
  );
}

/** Click `Done` and wait for the composer back. */
export async function done(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector('button.editor-done') as HTMLElement | null;
    if (button === null) throw new Error('done: no .editor-done');
    button.click();
  });
  await page.waitForFunction(
    () => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      return (
        (root?.querySelector('.wrap')?.getAttribute('data-wb-screen') ?? '') === 'composer' &&
        root?.querySelector('section.editor') === null
      );
    },
    null,
    { timeout: 10_000 },
  );
}

/* ---------------------------------------------------------------------------
 * Pixel evidence: decode the OUTGOING bytes in the engine that produced them
 * (the `analyzeImagePixels` discipline — no Node-side image dependency, and
 * never an assertion on canvas internals) and locate accent ink geometrically.
 * ------------------------------------------------------------------------- */

/** Count accent-ish pixels inside a bitmap-space box. */
export interface InkBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Count accent-ish pixels within `halfWidth` px of a bitmap-space segment. */
export interface InkBand {
  from: BitmapPoint;
  to: BitmapPoint;
  halfWidth: number;
}

/** Count accent-ish pixels along the PERPENDICULAR through `at` (0..1 along
 * the segment), reaching `reach` px to each side — the shaft-vs-head width
 * probe (ANN-02). */
export interface InkCross {
  from: BitmapPoint;
  to: BitmapPoint;
  at: number;
  reach: number;
}

export interface InkQueries {
  boxes?: InkBox[];
  bands?: InkBand[];
  crosses?: InkCross[];
}

export interface InkReport {
  boxes: number[];
  bands: number[];
  crosses: number[];
}

/**
 * Ink report over the outgoing image bytes. The whole analysis runs in-page:
 * decode → draw → `getImageData`, one shared `isInk` predicate (squared
 * distance to `#2f6feb` within `INK_TOLERANCE_SQ`).
 */
export async function analyzeInk(
  page: Page,
  bytes: Buffer,
  queries: InkQueries,
): Promise<InkReport> {
  const base64 = bytes.toString('base64');
  return page.evaluate(
    async (payload) => {
      const { binary, boxes, bands, crosses, toleranceSq, inkR, inkG, inkB } = payload;
      const raw = new Uint8Array(binary.length);
      for (let at = 0; at < binary.length; at += 1) raw[at] = binary.charCodeAt(at);
      const bitmap = await createImageBitmap(new Blob([raw.buffer as ArrayBuffer]));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('analyzeInk: a 2D canvas is unavailable');
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const width = canvas.width;
      const height = canvas.height;
      const isInk = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= width || y >= height) return false;
        const at = (y * width + x) * 4;
        const dr = data[at] - inkR;
        const dg = data[at + 1] - inkG;
        const db = data[at + 2] - inkB;
        return dr * dr + dg * dg + db * db <= toleranceSq;
      };
      const countBox = (box: { left: number; top: number; right: number; bottom: number }) => {
        let count = 0;
        for (let y = Math.floor(box.top); y < Math.ceil(box.bottom); y += 1) {
          for (let x = Math.floor(box.left); x < Math.ceil(box.right); x += 1) {
            if (isInk(x, y)) count += 1;
          }
        }
        return count;
      };
      const countBand = (band: {
        from: [number, number];
        to: [number, number];
        halfWidth: number;
      }) => {
        const seen = new Set<number>();
        let count = 0;
        const dx = band.to[0] - band.from[0];
        const dy = band.to[1] - band.from[1];
        const length = Math.max(1, Math.hypot(dx, dy));
        const step = 1;
        for (let walked = 0; walked <= length; walked += step) {
          const cx = Math.round(band.from[0] + (dx * walked) / length);
          const cy = Math.round(band.from[1] + (dy * walked) / length);
          for (let oy = -band.halfWidth; oy <= band.halfWidth; oy += 1) {
            for (let ox = -band.halfWidth; ox <= band.halfWidth; ox += 1) {
              const key = (cy + oy) * width + (cx + ox);
              if (seen.has(key)) continue;
              seen.add(key);
              if (isInk(cx + ox, cy + oy)) count += 1;
            }
          }
        }
        return count;
      };
      const countCross = (cross: {
        from: [number, number];
        to: [number, number];
        at: number;
        reach: number;
      }) => {
        const dx = cross.to[0] - cross.from[0];
        const dy = cross.to[1] - cross.from[1];
        const length = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / length;
        const uy = dy / length;
        const cx = cross.from[0] + dx * cross.at;
        const cy = cross.from[1] + dy * cross.at;
        const seen = new Set<number>();
        let count = 0;
        for (let s = -cross.reach; s <= cross.reach; s += 0.5) {
          const px = Math.round(cx + -uy * s);
          const py = Math.round(cy + ux * s);
          const key = py * width + px;
          if (seen.has(key)) continue;
          seen.add(key);
          if (isInk(px, py)) count += 1;
        }
        return count;
      };
      return {
        boxes: boxes.map(countBox),
        bands: bands.map(countBand),
        crosses: crosses.map(countCross),
      };
    },
    {
      binary: atob(base64),
      boxes: queries.boxes ?? [],
      bands: queries.bands ?? [],
      crosses: queries.crosses ?? [],
      toleranceSq: INK_TOLERANCE_SQ,
      inkR: INK_RGB[0],
      inkG: INK_RGB[1],
      inkB: INK_RGB[2],
    },
  );
}
