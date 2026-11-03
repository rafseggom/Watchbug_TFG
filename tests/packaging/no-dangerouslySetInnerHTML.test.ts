import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');

/**
 * One sink list for the panel, mirroring the SDK gate (`scripts/gate.mjs`):
 * forbidding only `dangerouslySetInnerHTML` and `innerHTML` leaves
 * `outerHTML`, `insertAdjacentHTML`, `document.write`, `srcdoc` and a
 * `javascript:` href as open bypasses.
 */
const SINKS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'dangerouslySetInnerHTML', pattern: /dangerouslySetInnerHTML/ },
  { name: 'innerHTML', pattern: /\binnerHTML\b/ },
  { name: 'outerHTML', pattern: /\bouterHTML\b/ },
  { name: 'insertAdjacentHTML', pattern: /\binsertAdjacentHTML\b/ },
  { name: 'document.write', pattern: /\bdocument\.write(?:ln)?\b/ },
  { name: 'srcdoc', pattern: /\bsrcDoc\b|\bsrcdoc\b/ },
  { name: 'javascript: URL', pattern: /\bjavascript\s*:/i },
];

describe('Packaging: no HTML-rendering sinks in apps/panel/src', () => {
  it('apps/panel/src contains none of the seven HTML sinks', () => {
    const files = readdirSync(resolve(repoRoot, 'apps/panel/src'), { recursive: true })
      .map((entry) => String(entry))
      .filter((entry) => /\.(ts|tsx|css)$/.test(entry));
    expect(files.length).toBeGreaterThan(3);

    const hits: string[] = [];
    for (const file of files) {
      const source = readFileSync(resolve(repoRoot, 'apps/panel/src', file), 'utf8');
      for (const sink of SINKS) {
        if (sink.pattern.test(source)) hits.push(`${file}: ${sink.name}`);
      }
    }
    expect(hits, `HTML sinks found in the panel:\n  ${hits.join('\n  ')}`).toEqual([]);
  });
});
