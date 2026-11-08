import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * R-19 doc consistency, as an executable gate (type 6 — packaging/environment).
 *
 * The policy amendment is only real if the documents agree. R-12 said "no unit
 * tests, ever" in prose; once R-19 replaced it, every surviving copy of that
 * absolute is a contradiction waiting to mislead the next contributor. A grep
 * someone remembers to run is a comment — so the grep is a test.
 *
 * Rule: a file may quote the old absolute **only if it declares the
 * supersession first**. The marker must precede the quote, so a reader of that
 * document meets the correction before the claim, not after it.
 *
 * The allow-list is deliberately tiny and each entry states why it is exempt.
 * Growing it is a decision, not a convenience: an entry without a reason is a
 * hole in the gate.
 */

const repoRoot = resolve(__dirname, '../..');

/** The absolutes R-19 retired. */
const RETIRED_ABSOLUTES: Array<{ name: string; pattern: RegExp }> = [
  { name: 'no unit tests', pattern: /no unit[ -]tests?\b/i },
  { name: 'never unit tests', pattern: /never unit[ -]tests?\b/i },
  { name: 'DONT MAKE A BUNCH OF TESTS', pattern: /DONT MAKE A BUNCH/i },
  { name: 'no other test artefact', pattern: /no other test artefact/i },
  { name: 'unit-test suite abolished', pattern: /unit-test suite abolished/i },
  // Added 2026-11-08. The five patterns above were written against the sentence
  // that lived in AGENTS.md; the same claim was also present, worded differently,
  // in two governing docs and matched none of them. A gate that only knows one
  // phrasing of a claim does not check the claim.
  { name: 'unit-test suites out of scope', pattern: /unit[ -]test suites? and coverage thresholds/i },
  { name: 'e2e and property assertions only', pattern: /e2e and property assertions only/i },
];

/** A file declares the amendment with any of these. */
const SUPERSESSION_MARKERS = [
  /Superseded by R-19/i,
  /amended by R-19/i,
  /R-19 (?:replaces|supersedes|amends)/i,
  /R-19 amends R-12/i,
];

/**
 * Files that may state the absolute without a per-file banner.
 * Every entry needs a reason that survives review.
 */
const EXEMPT: Array<{ path: string; reason: string }> = [
  {
    path: '.planning/phases/03-report-composer-annotation-editor-lazy/03-08-PLAN.md',
    reason:
      'The specification of the amendment itself. It must quote the retired absolute verbatim to name what it replaces, and it contains the grep pattern the gate paraphrases; marking it "predates R-19" would be false.',
  },
];

/**
 * Frozen history: these artifacts were written under the retired policy and
 * quote it as evidence. They are allowed a file-level banner.
 *
 * Everything else is treated as a living document and must qualify a quote in
 * the section that contains it. The list is positive on purpose — a new file
 * defaults to the stricter rule, so nothing becomes historical by accident.
 *
 * `.planning/` is NOT a synonym for "historical". PROJECT.md, REQUIREMENTS.md,
 * ROADMAP.md and CONVENTIONS.md are governing docs that happen to live there;
 * classifying by path put the two most-drifted documents in the lenient bucket,
 * where one marker anywhere in a 294-line file excused every contradiction
 * below it (found 2026-11-08, see continuity-pack §12). STATE.md and WINDOWS.md
 * stay historical: they are running journals of decisions already taken and of
 * platform incidents, not policy.
 */
const HISTORICAL_DIRECTORIES = ['.planning/phases/', '.planning/quick/', '.planning/quick-batches/', '.planning/research/'];
const HISTORICAL_FILES = new Set(['.planning/STATE.md', '.planning/WINDOWS.md']);

const isHistorical = (file: string): boolean =>
  HISTORICAL_FILES.has(file) || HISTORICAL_DIRECTORIES.some((prefix) => file.startsWith(prefix));

const SCAN_ROOTS = ['AGENTS.md', 'README.md', 'package.json', '.github', 'documentation', 'scripts', '.planning'];
const SCAN_EXTENSIONS = ['.md', '.mjs', '.ts', '.yml', '.yaml', '.json'];

function walk(target: string, out: string[]): void {
  const absolute = resolve(repoRoot, target);
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    return; // an absent path is not this gate's business
  }
  if (stats.isFile()) {
    if (SCAN_EXTENSIONS.some((extension) => target.endsWith(extension))) out.push(target);
    return;
  }
  for (const entry of readdirSync(absolute)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    walk(join(target, entry), out);
  }
}

/**
 * Test files themselves are excluded: this suite and its fixtures must be able
 * to *name* the patterns they forbid (the middle of that sentence is a pattern,
 * and a gate that forbids its own vocabulary cannot be written).
 */
const SELF = relative(repoRoot, __filename).replaceAll('\\', '/');

const files: string[] = [];
for (const root of SCAN_ROOTS) walk(root, files);

interface Violation {
  file: string;
  line: number;
  absolute: string;
  text: string;
}

const violations: Violation[] = [];
const scoped: Array<{ file: string; quotes: number }> = [];
const exemptHits: Array<{ file: string; line: number; absolute: string }> = [];

for (const file of files) {
  const slash = file.replaceAll('\\', '/');
  if (slash === SELF) continue;

  const lines = readFileSync(resolve(repoRoot, file), 'utf8').split(/\r?\n/);
  const exemption = EXEMPT.find((entry) => slash === entry.path);
  let quotes = 0;

  // Historical planning artifacts were written under the old policy and quote
  // it in their evidence blocks; a marker anywhere in the file is accepted
  // for them. Everything else — including the governing docs under .planning/ —
  // must qualify the absolute in its own section, so a banner cannot launder a
  // later contradiction.
  const historicalFileMarker =
    isHistorical(slash) && lines.some((line) => SUPERSESSION_MARKERS.some((m) => m.test(line)));
  const sectionStartAt = (index: number): number => {
    for (let at = index; at >= 0; at -= 1) {
      if (/^#{1,6}\s/.test(lines[at])) return at;
    }
    return 0;
  };
  const hasMarkerInSection = (index: number): boolean =>
    lines.slice(sectionStartAt(index), index + 1).some((line) => SUPERSESSION_MARKERS.some((m) => m.test(line)));

  for (const [index, line] of lines.entries()) {
    const absolute = RETIRED_ABSOLUTES.find((candidate) => candidate.pattern.test(line));
    if (absolute === undefined) continue;
    quotes++;

    if (exemption !== undefined) {
      exemptHits.push({ file: slash, line: index + 1, absolute: absolute.name });
      continue;
    }
    // The marker may appear in the same section (a section-level banner), on
    // the same line as an inline qualifier, or — for historical .planning
    // artifacts only — as a file-level banner before the quote.
    if (hasMarkerInSection(index) || SUPERSESSION_MARKERS.some((m) => m.test(line))) continue;
    if (historicalFileMarker) continue;
    violations.push({ file: slash, line: index + 1, absolute: absolute.name, text: line.trim().slice(0, 180) });
  }

  if (quotes > 0) scoped.push({ file: slash, quotes });
}

describe('R-19 doc consistency: no document states the retired absolute unqualified', () => {
  it('every quote of a retired absolute is preceded by a supersession marker', () => {
    const report = violations.map((v) => `  ${v.file}:${v.line} [${v.absolute}] ${v.text}`).join('\n');
    expect(violations, `unqualified retired absolutes:\n${report}`).toEqual([]);
  });

  it('scanned a non-empty surface — the gate cannot pass by finding nothing to read', () => {
    // A gate that silently walks zero files is green and worthless.
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('AGENTS.md');
  });

  it('the governing documents agree with each other', () => {
    // PROJECT.md was missing from this list until 2026-11-08: the one document
    // that contradicted R-19 was the one the "they agree" test never read.
    const governing = [
      'AGENTS.md',
      'documentation/resolution-record.md',
      '.planning/PROJECT.md',
      '.planning/ROADMAP.md',
      '.planning/REQUIREMENTS.md',
    ];
    for (const file of governing) {
      const text = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(text, `${file} must mention R-19`).toMatch(/R-19/);
      expect(text, `${file} must name the amendment relationship`).toMatch(
        /R-19[ ,]*(?:which )?(?:amends|amending|replaces|supersedes)[^.\n]{0,10}R-12|amended by R-19|Superseded by R-19/i,
      );
    }
  });

  it('the exemption list stays justified — every entry carries a real reason', () => {
    for (const entry of EXEMPT) {
      expect(entry.reason.length, `${entry.path} needs a substantive reason`).toBeGreaterThan(60);
    }
    // Exemptions that no longer match anything are dead weight; say so.
    for (const entry of EXEMPT) {
      expect(exemptHits.some((hit) => hit.file === entry.path), `${entry.path} is exempt but quotes nothing`).toBe(true);
    }
  });

  it('reports which documents inherit the marker (evidence, not a claim)', () => {
    // Printed by vitest on failure only, but the assertion keeps this honest:
    // the historical artifacts must actually be scoped, not merely tolerated.
    const historical = scoped.filter((entry) => entry.file.startsWith('.planning/'));
    expect(historical.length).toBeGreaterThan(5);
  });
});
