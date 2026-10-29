import { describe, expect, it } from 'vitest';
import {
  INPUT_VALUE_FAMILIES,
  PATTERN_FAMILIES,
  TEXT_FAMILIES,
  luhnValid,
  type PatternFamily,
} from '@watchbug/sdk/redact/patterns.ts';

/**
 * Unit lane for the P2-D-07 catalog — the pure-logic half of the **J-04**
 * auto-redaction family (03-08 Batch 3b).
 *
 * The J-04 e2e rows intercept the outgoing request, decode the attached image
 * inside the engine that produced it and assert that zero original pixels
 * survive in the mask rect and its 1-px ring. That is the artifact-level
 * proof R-19 keeps in e2e — but it is a poor place to fail for the *decision*:
 * which text made a family match at all, and which lookalike deliberately did
 * not. That decision is this module (a handful of regexes plus a hand-rolled
 * Luhn check, no DOM), so it is pinned here with the **exact fixtures** the
 * e2e rows inject. Neither layer duplicates the other: pixels stay e2e,
 * matching is here.
 *
 * The negative controls are as load-bearing as the positives. P2-D-07 locks
 * "a Luhn-invalid lookalike stays visible" and the JWT `eyJ` prefix: a false
 * positive is harmless, but silently over-masking legitimate content is a
 * product bug, and a *false negative is a leak* (P2-D-09).
 */

/** The JWT fixture every artifact row masks (row "PRV-02: JWT shape …"). */
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.Um9ja2V0U2lnbmF0dXJlMTIzNDU2Nzg5'; // gitleaks:allow

/** The mask walk's control: the same dotted triple without the `eyJ` prefix. */
const JWT_LOOKALIKE = 'xJhdXRv.NExhbWVfaWRlbnRpdHlfOTk5OTk5.SGNyZWRzX3NpZ25hdHVyZV8xMjM0';

/** Row "PRV-02: a bearer-token shape …" — prose, not a bare token. */
const BEARER_TEXT =
  "const auth = { headers: { Authorization: 'Bearer sk_live_51AbCdEfGhIjKlMn' } };"; // gitleaks:allow

/** Row "PRV-02: key=/token=/secret=/password= assignments …". */
const ASSIGNMENT_TEXT =
  'const login = { password: correctHorseBattery9, api_key: wbt_live_7f3a9c21 }'; // gitleaks:allow

const CARD_VALID = '4111111111111111';
/** Same shape, one digit off the checksum — the locked visible lookalike. */
const CARD_INVALID = '4242424242424241';
/** Row "PRV-02: two Luhn-valid cards glued in one text node …" (review CR-02). */
const CARDS_GLUED = '4111111111111111 4242424242424242';

/** Every substring one family finds in `text`. */
function matchesOf(family: PatternFamily, text: string): string[] {
  // The catalog is shared mutable state (`g` regexes carry `lastIndex`), so a
  // row must never inherit the previous row's scan position.
  family.regex.lastIndex = 0;
  return [...text.matchAll(family.regex)].map((match) => match[0]);
}

/**
 * The ids a text-node pass would mask for — the redactor's own rule: a family
 * counts when it matches at least one substring that also passes its
 * `validate` (only the card family has one).
 */
function familiesHit(text: string): string[] {
  return TEXT_FAMILIES.filter((family) => {
    const matches = matchesOf(family, text);
    if (matches.length === 0) return false;
    const validate = family.validate;
    return validate === undefined || matches.some((match) => validate(match));
  }).map((family) => family.id);
}

describe('unit: P2-D-07 redaction pattern catalog', () => {
  it('records every family once per DOM location — four ids, both sources', () => {
    expect(PATTERN_FAMILIES).toHaveLength(8);
    expect([...new Set(PATTERN_FAMILIES.map((family) => family.id))].sort()).toEqual([
      'assignment',
      'assignment-in-input',
      'bearer',
      'bearer-in-input',
      'card',
      'card-in-input',
      'jwt',
      'jwt-in-input',
    ]);

    // The two split views are exactly a partition of the catalog: the redactor
    // walks `TEXT_FAMILIES` over text nodes and `INPUT_VALUE_FAMILIES` over
    // control values, so a dropped entry would silently lose a whole surface.
    expect(TEXT_FAMILIES.every((family) => family.source === 'text-node')).toBe(true);
    expect(INPUT_VALUE_FAMILIES.every((family) => family.source === 'input-value')).toBe(true);
    expect(TEXT_FAMILIES.length + INPUT_VALUE_FAMILIES.length).toBe(PATTERN_FAMILIES.length);
  });

  it('matches the JWT dotted triple the artifact rows mask', () => {
    expect(familiesHit(JWT)).toEqual(['jwt']);
    // Matched as a SUBSTRING of the containing text node: P2-D-08 masks the
    // whole node, so surrounding prose must not defeat the match.
    expect(familiesHit(`before ${JWT} after`)).toEqual(['jwt']);
  });

  it('leaves the eyJ-less lookalike visible — the negative control', () => {
    // Non-vacuity: it really is a three-segment base64url dotted triple, so it
    // fails only because the family requires the `eyJ` header prefix.
    expect(JWT_LOOKALIKE.split('.')).toHaveLength(3);
    expect(familiesHit(JWT_LOOKALIKE)).toEqual([]);
  });

  it('matches the auth-scheme shape inside ordinary prose', () => {
    expect(familiesHit(BEARER_TEXT)).toEqual(['bearer']);
  });

  it('matches credential assignments, including the underscored key spelling', () => {
    const matches = matchesOf(
      TEXT_FAMILIES.find((family) => family.id === 'assignment') as PatternFamily,
      ASSIGNMENT_TEXT,
    );
    // Recall beats precision (P2-D-09): no leading word boundary, so `api_key=`
    // matches as `key=`. Both assignments in the fixture are caught.
    expect(matches).toHaveLength(2);
    expect(matches[0].startsWith('password')).toBe(true);
    expect(matches[1].startsWith('key')).toBe(true);
    expect(familiesHit(ASSIGNMENT_TEXT)).toEqual(['assignment']);
  });

  it('accepts Luhn-valid runs and rejects the lookalike — the P2-D-07 rule', () => {
    expect(luhnValid(CARD_VALID)).toBe(true);
    expect(luhnValid('4242424242424242')).toBe(true);
    expect(luhnValid(CARD_INVALID)).toBe(false);

    expect(familiesHit(CARD_VALID)).toEqual(['card']);
    expect(familiesHit(CARD_INVALID)).toEqual([]);
  });

  it('rejects anything that is not a 13–19 digit run', () => {
    expect(luhnValid('411111111111')).toBe(false); // 12 digits, one short
    expect(luhnValid('41111111111111111111')).toBe(false); // 20 digits, one over
    expect(luhnValid('4111-1111-1111-1111')).toBe(false); // separators are not digits
    expect(luhnValid('card number here')).toBe(false);
    expect(luhnValid('')).toBe(false);
  });

  it('validates the glued two-card run by its digit groups (review CR-02)', () => {
    // The greedy CARD_SHAPE match glues both cards into one run; validating
    // that run as a single Luhn body fails for every such spelling, which is
    // why the family validates groups and contiguous group joins instead.
    const card = TEXT_FAMILIES.find((family) => family.id === 'card') as PatternFamily;
    const matches = matchesOf(card, CARDS_GLUED);
    expect(matches.length).toBeGreaterThan(0);
    expect(luhnValid(matches[0].replace(/[^0-9]/g, ''))).toBe(false);
    expect(familiesHit(CARDS_GLUED)).toEqual(['card']);
  });
});
