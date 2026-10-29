import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * R-19's journey cap, enforced **structurally** (03-08 Task 3d).
 *
 * AGENTS.md caps the e2e suite at ≤ 20 core user journeys (J-01..J-20) and
 * reserves J-15..J-20 for Phases 4–7. A cap that only exists in a document is
 * a cap that erodes one row at a time, so the shape is asserted here instead:
 *
 *  - every journey is exactly one top-level `test.describe('J-NN — …')` block,
 *  - the widget subset is J-01..J-14 and appears once each, in its home spec
 *    (`sdk.spec.ts` for J-01..J-13, `hostile.spec.ts` for J-14),
 *  - **no** `test(` row sits outside a journey block,
 *  - J-15..J-20 do not exist yet.
 *
 * This is a type-6 environment/packaging test: it reads files and needs no
 * browser, so it fails in milliseconds the moment a 15th widget journey (or a
 * stray top-level row) creeps in.
 */

const repoRoot = resolve(__dirname, '../..');

/** Journey describe titles are `J-NN — ` (em dash) so they cannot collide with a row title. */
const JOURNEY_DESCRIBE = /^test\.describe\('(J-\d\d) — /gm;
/** A row declared at column 0 — i.e. outside every journey block. */
const TOP_LEVEL_ROW = /^test(?:\.only|\.skip|\.fixme)?\(/gm;
/** A test or describe *titled* with a reserved journey number (comments may mention the range). */
const RESERVED_JOURNEY = /test(?:\.describe)?\(\s*['"]J-(?:1[5-9]|20)\b/g;

function read(relative: string): string {
  return readFileSync(resolve(repoRoot, relative), 'utf8');
}

function journeysIn(source: string): string[] {
  return [...source.matchAll(JOURNEY_DESCRIBE)].map((match) => match[1]);
}

function countsRowDeclarations(source: string): number {
  return [...source.matchAll(/^\s+test\(/gm)].length;
}

describe('Packaging: R-19 journey cap is structural', () => {
  const sdk = read('e2e/sdk.spec.ts');
  const hostile = read('e2e/hostile.spec.ts');

  it('sdk.spec.ts declares the widget journeys J-01..J-13, one block each', () => {
    const journeys = journeysIn(sdk);
    expect(journeys).toEqual([
      'J-01',
      'J-02',
      'J-03',
      'J-04',
      'J-05',
      'J-06',
      'J-07',
      'J-08',
      'J-09',
      'J-10',
      'J-11',
      'J-12',
      'J-13',
    ]);
    // Non-vacuity: the file really does carry the row inventory the ledger
    // reconciles (79 declarations), not thirteen empty shells.
    expect(countsRowDeclarations(sdk)).toBeGreaterThanOrEqual(70);
  });

  it('hostile.spec.ts declares J-14 in exactly one block', () => {
    expect(journeysIn(hostile)).toEqual(['J-14']);
    // The J-14 inventory is 8 declarations of which one is a 4-variant loop;
    // counting instances is Playwright's job (`--list`), so only the lower
    // bound is asserted here.
    expect(countsRowDeclarations(hostile)).toBeGreaterThanOrEqual(8);
  });

  it('no e2e row lives outside a journey describe', () => {
    for (const [label, source] of [
      ['e2e/sdk.spec.ts', sdk],
      ['e2e/hostile.spec.ts', hostile],
    ] as const) {
      expect([...source.matchAll(TOP_LEVEL_ROW)].map((match) => match[0]), label).toEqual([]);
    }
  });

  it('the widget subset is exactly J-01..J-14 — no duplicates, never more than 14', () => {
    const all = [...journeysIn(sdk), ...journeysIn(hostile)];
    expect(all).toHaveLength(14);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual([
      'J-01',
      'J-02',
      'J-03',
      'J-04',
      'J-05',
      'J-06',
      'J-07',
      'J-08',
      'J-09',
      'J-10',
      'J-11',
      'J-12',
      'J-13',
      'J-14',
    ]);
    // The hard R-19 ceiling, restated where a breach would actually fail.
    expect(all.length).toBeLessThanOrEqual(20);
  });

  it('J-15..J-20 stay reserved for Phases 4–7', () => {
    const specs = readdirSync(resolve(repoRoot, 'e2e')).filter((entry) => entry.endsWith('.spec.ts'));
    expect(specs.length).toBeGreaterThanOrEqual(3);

    for (const spec of specs) {
      const reserved = [...read(`e2e/${spec}`).matchAll(RESERVED_JOURNEY)].map((match) => match[0]);
      expect(reserved, `${spec} must not claim a reserved journey`).toEqual([]);
    }
  });
});
