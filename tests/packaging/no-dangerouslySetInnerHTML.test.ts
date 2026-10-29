import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');

describe('Packaging: no HTML-rendering sinks in apps/panel/src', () => {
  it('apps/panel/src contains no dangerouslySetInnerHTML or innerHTML assignments', () => {
    const files = readdirSync(resolve(repoRoot, 'apps/panel/src'), { recursive: true })
      .map((entry) => String(entry))
      .filter((entry) => /\.(ts|tsx|css)$/.test(entry));
    expect(files.length).toBeGreaterThan(3);

    for (const file of files) {
      const source = readFileSync(resolve(repoRoot, 'apps/panel/src', file), 'utf8');
      expect(source.includes('dangerouslySetInnerHTML'), `${file} must not contain a dangerouslySetInnerHTML sink`).toBe(false);
      expect(source.includes('innerHTML'), `${file} must not contain an innerHTML sink`).toBe(false);
    }
  });
});