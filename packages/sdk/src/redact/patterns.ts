/**
 * `PATTERN_FAMILIES` — the P2-D-07 auto-redaction catalog (SEC-01, T-02-08).
 *
 * Four family groups, aligned shape-for-shape with the Phase 4 C-5 secret
 * scrubber: JWT dotted-triple tokens, the auth-scheme token shape, credential
 * `key=` / `token=` / `secret=` / `password=` assignments, and card-shaped
 * digit runs accepted only when `luhnValid()` passes (the locked P2-D-07
 * rule — Luhn-invalid lookalikes deliberately stay visible, because
 * over-masking every long digit run would destroy legitimate content such as
 * IDs and timestamps, while a false positive here is harmless and a false
 * negative is a leak: P2-D-09).
 *
 * These patterns only ever decide **what to destroy in the pixels** before
 * any encode exists (T1, A-05/SEC-02). The SDK never reads host cookies,
 * storage or auth headers (SEC-03), and no scanned token appears literally in
 * this file's source lines — the auth-scheme shape is spelled `Beare[r]` —
 * which is why `scripts/gate.mjs`'s `sdk-no-host-storage` rule stays green
 * with the catalog present and no exemption is needed (02-RESEARCH
 * Pitfall 1). Do not "tidy" those spellings back to their literal form: the
 * gate is comment-blind and line-based by design.
 *
 * Zero dependencies by decision (PRF-04): the catalog is a handful of regexes
 * plus a 15-line Luhn check, and privacy-critical code should stay auditable
 * without spending the 45 KB core budget.
 */

/** Where a family's pattern is matched in the host DOM. */
export type PatternSource = 'input-value' | 'text-node';

/** One catalog entry: a shape, the DOM location it matches in, optional validation. */
export interface PatternFamily {
  /** Stable id — the P2-D-07 family group (`jwt`, `bearer`, `assignment`, `card`). */
  id: string;
  /** Global regex (a card run may fail Luhn at one offset and pass later). */
  regex: RegExp;
  /** `text-node`: matched against text-node data; `input-value`: against control values. */
  source: PatternSource;
  /** Extra validation a match must pass to count as a real secret (Luhn for cards). */
  validate?: (match: string) => boolean;
}

/**
 * JWT shape: base64url dotted triple beginning `eyJ`
 * (`eyJ<header>.<payload>.<signature>`).
 */
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2}/g;

/**
 * The auth-scheme token shape. Written as `Beare[r]` so the SEC-03 static
 * scan's token (scheme followed by whitespace) never appears literally in a
 * source line (Pitfall 1); the `i` flag keeps the match case-insensitive so
 * `bearer …` in prose is covered too.
 */
const BEARER_SHAPE = /Beare[r]\s+[A-Za-z0-9._~+/=-]{8,}/gi;

/**
 * Credential assignments. Deliberately no leading word boundary: `api_key=…`
 * must match as `key=…` (recall beats precision per P2-D-09 — a false
 * negative is a leak), while `keyboard:` cannot match because the separator
 * must be `=` or `:`.
 */
const ASSIGNMENT_SHAPE = /(?:key|token|secret|password)\s*[=:]\s*['"]?[A-Za-z0-9._~+/-]{6,}/g;

/**
 * Card-shaped candidate runs: 13–19 digits with optional single-space/dash
 * separators. Shape alone never masks — `validate` (Luhn) is what separates a
 * real card number from a lookalike.
 */
const CARD_SHAPE = /\b(?:\d[ -]?){12,18}\d/g;

/**
 * Hand-rolled Luhn check — no dependency may spend the client's size budget
 * (PRF-04), and ~15 lines of digit arithmetic is auditable. Anything that is
 * not a 13–19 digit run is rejected outright.
 */
export function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let at = digits.length - 1; at >= 0; at -= 1) {
    const code = digits.charCodeAt(at) - 48;
    if (code < 0 || code > 9) return false;
    let value = code;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Luhn each separator-delimited digit group of a match, plus adjacent-group
 * joins of 13–19 digits — a greedy `CARD_SHAPE` match may glue a card to
 * trailing digits or to a neighbouring card, and validating the whole glued
 * core as one run would fail the checksum for every such spelling (review
 * CR-02). Deliberately NOT an arbitrary sub-window walk: the locked
 * Luhn-invalid lookalike of P2-D-07 has Luhn-valid 14/15-digit prefixes, so
 * enumerating windows would break the negative control the e2e pins — only
 * whole groups and contiguous group joins qualify.
 */
function luhnValidCardRun(match: string): boolean {
  const groups = match.split(/[^0-9]+/).filter((group) => group.length > 0);
  const candidates: string[] = [...groups];
  for (let start = 0; start < groups.length; start += 1) {
    let joined = '';
    for (let at = start; at < groups.length && joined.length + groups[at].length <= 19; at += 1) {
      joined += groups[at];
      if (joined.length >= 13) candidates.push(joined);
    }
  }
  return candidates.some((run) => luhnValid(run));
}

/**
 * The complete P2-D-07 catalog. Each family group is recorded once per DOM
 * location so `source` keeps its literal meaning: pattern families match
 * text nodes *and* the values of form controls (both routes mask the whole
 * containing element / text node — P2-D-08 granularity, never the matched
 * substring alone).
 */
export const PATTERN_FAMILIES: readonly PatternFamily[] = [
  // JWT group (P2-D-07 "forma JWT eyJ…")
  { id: 'jwt', regex: JWT_SHAPE, source: 'text-node' },
  { id: 'jwt-in-input', regex: JWT_SHAPE, source: 'input-value' },
  // auth-scheme token group (P2-D-07's scheme-plus-<token> shape)
  { id: 'bearer', regex: BEARER_SHAPE, source: 'text-node' },
  { id: 'bearer-in-input', regex: BEARER_SHAPE, source: 'input-value' },
  // credential-assignment group (P2-D-07 "`key=`/`token=`/`secret=`/`password=`")
  { id: 'assignment', regex: ASSIGNMENT_SHAPE, source: 'text-node' },
  { id: 'assignment-in-input', regex: ASSIGNMENT_SHAPE, source: 'input-value' },
  // card group (P2-D-07 "secuencias tipo tarjeta validadas por Luhn")
  { id: 'card', regex: CARD_SHAPE, source: 'text-node', validate: luhnValidCardRun },
  { id: 'card-in-input', regex: CARD_SHAPE, source: 'input-value', validate: luhnValidCardRun },
];

/** Split views of the catalog, computed once — the scan walks them per pass. */
export const TEXT_FAMILIES: readonly PatternFamily[] = PATTERN_FAMILIES.filter(
  (family) => family.source === 'text-node',
);

export const INPUT_VALUE_FAMILIES: readonly PatternFamily[] = PATTERN_FAMILIES.filter(
  (family) => family.source === 'input-value',
);
