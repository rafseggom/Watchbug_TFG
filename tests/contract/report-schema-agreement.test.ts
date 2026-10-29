import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { reportSchema } from '@watchbug/contracts/schema';
import {
  MAX_NOTE_CHARS,
  MAX_TITLE_CHARS,
  MAX_URL_PATH_CHARS,
  MAX_USER_EMAIL_CHARS,
  MAX_USER_ID_CHARS,
  MAX_USER_NAME_CHARS,
} from '@watchbug/contracts/constants';

/**
 * CA-01's **contract half**, as a first-class test (R-19 type 5).
 *
 * Three different things can drift apart in this project, and each gets its
 * own assertion:
 *
 *   1. `packages/contracts/src/schema.ts` (the Zod runtime schema the API
 *      validates with) vs `schema/report.schema.json` (the published artifact
 *      integrators read). Drift here means the documented contract lies.
 *      → "the committed artifact is exactly what Zod emits today"
 *   2. The artifact vs an actual payload. A schema nobody parses is
 *      documentation, not a contract.
 *      → the subset validator below walks the *committed file* over a real
 *        payload and over payloads that must be rejected.
 *   3. The artifact's numeric bounds vs `constants.ts` (R-18: bounds live in
 *      one place). A restated literal is a silent divergence waiting to happen.
 *      → "every published bound is the constant, not a copy of it"
 *
 * The validator is a deliberately tiny draft-2020-12 subset interpreter
 * (`type` / `enum` / `minLength` / `maxLength` / `anyOf` / `required` /
 * `properties` / `additionalProperties`) — exactly the keywords this schema
 * uses, and nothing more. Adding `ajv` for a 60-line schema would be a
 * dependency bought to avoid reading; if the schema ever grows a keyword this
 * interpreter does not know, the "unknown keyword" assertion below fails
 * loudly instead of silently under-validating.
 */

const repoRoot = resolve(__dirname, '../..');
const artifactPath = resolve(repoRoot, 'schema/report.schema.json');

/** The committed artifact, read from disk on every run — never a local copy. */
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8').replace(/^\uFEFF/, '')) as JsonSchema;

interface JsonSchema {
  $schema?: string;
  description?: string;
  type?: string | string[];
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  [keyword: string]: unknown;
}

const KNOWN_SCHEMA_KEYWORDS = new Set([
  '$schema',
  'description',
  'title',
  'type',
  'enum',
  'minLength',
  'maxLength',
  'required',
  'properties',
  'additionalProperties',
  'anyOf',
]);

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Returns every violation; an empty array means "valid against the artifact". */
function validate(schema: JsonSchema, value: unknown, path = '$'): string[] {
  const errors: string[] = [];

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.includes(typeOf(value))) {
      // Deeper keywords cannot say anything useful once the type is wrong.
      return [`${path}: expected ${types.join('|')}, got ${typeOf(value)}`];
    }
  }

  if (schema.enum !== undefined && !schema.enum.some((allowed) => allowed === value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: length ${value.length} < minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: length ${value.length} > maxLength ${schema.maxLength}`);
    }
  }

  if (schema.anyOf !== undefined) {
    const branchResults = schema.anyOf.map((branch) => validate(branch, value, path));
    if (!branchResults.some((branchErrors) => branchErrors.length === 0)) {
      const detail = branchResults.map((branchErrors) => branchErrors[0] ?? 'ok').join(' | ');
      errors.push(`${path}: matched no anyOf branch (${detail})`);
    }
  }

  if (typeOf(value) === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) errors.push(`${path}.${key}: required property missing`);
    }
    const properties = schema.properties ?? {};
    for (const [key, subSchema] of Object.entries(properties)) {
      if (key in record) errors.push(...validate(subSchema, record[key], `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!(key in properties)) errors.push(`${path}.${key}: additional property is not allowed`);
      }
    }
  }

  return errors;
}

/** Walk every subschema so an unhandled keyword fails instead of passing vacuously. */
function collectUnknownKeywords(schema: JsonSchema, path = '$'): string[] {
  const unknown: string[] = [];
  for (const keyword of Object.keys(schema)) {
    if (!KNOWN_SCHEMA_KEYWORDS.has(keyword)) unknown.push(`${path}: "${keyword}"`);
  }
  for (const [key, sub] of Object.entries(schema.properties ?? {})) {
    unknown.push(...collectUnknownKeywords(sub, `${path}.${key}`));
  }
  for (const [index, branch] of (schema.anyOf ?? []).entries()) {
    unknown.push(...collectUnknownKeywords(branch, `${path}.anyOf[${index}]`));
  }
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties === 'object') {
    unknown.push(...collectUnknownKeywords(schema.additionalProperties, `${path}.additionalProperties`));
  }
  return unknown;
}

/** A representative wire payload — the shape the SDK actually posts. */
const VALID_PAYLOAD = {
  type: 'bug',
  title: 'Checkout total is wrong after the promo code applies',
  note: 'Steps: 1. add two items 2. apply SAVE10 3. the total keeps the pre-promo subtotal.',
  url: '/checkout',
  user: { id: 'u_8812', name: 'Ada Lovelace', email: 'ada@example.com' },
} as const;

/** The smallest payload the contract allows: only the two required fields. */
const MINIMAL_PAYLOAD = { type: 'feedback', title: 'Loving the new composer' } as const;

describe('CA-01 contract: the published artifact is the Zod schema, re-emitted', () => {
  it('schema/report.schema.json is exactly what z.toJSONSchema(reportSchema) emits today', () => {
    // Same options as packages/contracts/scripts/emit-schema.mjs. `io: 'input'`
    // because the R-08 `url` transform is not representable in output mode and
    // the published artifact describes the *wire* (request) shape.
    const reEmitted = z.toJSONSchema(reportSchema, { target: 'draft-2020-12', io: 'input' });
    expect(reEmitted).toEqual(artifact);
  });

  it('declares draft 2020-12 and a closed root object', () => {
    expect(artifact.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(artifact.type).toBe('object');
    expect(artifact.additionalProperties).toBe(false);
    expect(artifact.required).toEqual(['type', 'title']);
  });

  it('uses no keyword this suite cannot interpret — under-validating is not an option', () => {
    expect(collectUnknownKeywords(artifact)).toEqual([]);
  });
});

describe('CA-01 contract: the artifact accepts what the contract allows', () => {
  it('accepts a representative full payload', () => {
    expect(validate(artifact, VALID_PAYLOAD)).toEqual([]);
  });

  it('accepts the minimal payload — only type and title are required', () => {
    expect(validate(artifact, MINIMAL_PAYLOAD)).toEqual([]);
  });

  it('accepts explicit nulls on every optional field (the SDKs nullable default)', () => {
    expect(validate(artifact, { type: 'bug', title: 't', note: null, url: null, user: null })).toEqual([]);
  });

  it('accepts a user object with only an id', () => {
    expect(validate(artifact, { type: 'feedback', title: 't', user: { id: 'u_1' } })).toEqual([]);
  });
});

describe('CA-01 contract: the artifact rejects what the contract forbids', () => {
  const rejected: Array<{ name: string; payload: unknown; expected: RegExp }> = [
    {
      name: 'a missing title',
      payload: { type: 'bug' },
      expected: /title: required property missing/,
    },
    {
      name: 'a missing type',
      payload: { title: 'only a title' },
      expected: /type: required property missing/,
    },
    {
      name: 'a type outside the enum',
      payload: { type: 'question', title: 't' },
      expected: /is not one of \["bug","feedback"\]/,
    },
    {
      name: 'an empty title',
      payload: { type: 'bug', title: '' },
      expected: /minLength 1/,
    },
    {
      name: 'a title past the published cap',
      payload: { type: 'bug', title: 'x'.repeat(MAX_TITLE_CHARS + 1) },
      expected: new RegExp(`maxLength ${MAX_TITLE_CHARS}`),
    },
    {
      name: 'a note past the published cap',
      payload: { type: 'bug', title: 't', note: 'x'.repeat(MAX_NOTE_CHARS + 1) },
      expected: new RegExp(`maxLength ${MAX_NOTE_CHARS}`),
    },
    {
      name: 'a non-string title',
      payload: { type: 'bug', title: 42 },
      expected: /title: matched no anyOf branch|title: expected string/,
    },
    {
      name: 'an unknown top-level field (the payload stays closed)',
      payload: { type: 'bug', title: 't', severity: 'P0' },
      expected: /additional property is not allowed/,
    },
    {
      name: 'an unknown field inside user',
      payload: { type: 'bug', title: 't', user: { id: 'u_1', role: 'admin' } },
      expected: /user\.role: additional property is not allowed/,
    },
  ];

  for (const { name, payload, expected } of rejected) {
    it(`rejects ${name}`, () => {
      const errors = validate(artifact, payload);
      expect(errors.length, `expected ${name} to be rejected, got ${JSON.stringify(errors)}`).toBeGreaterThan(0);
      expect(errors.join('\n')).toMatch(expected);
    });
  }

  it('rejects a non-object payload outright', () => {
    expect(validate(artifact, 'a bare string')[0]).toMatch(/expected object/);
  });
});

describe('CA-01 contract: the artifact and the Zod schema agree, both ways', () => {
  it('every payload the artifact accepts, Zod accepts', () => {
    for (const payload of [VALID_PAYLOAD, MINIMAL_PAYLOAD, { type: 'bug', title: 't', user: null }]) {
      expect(validate(artifact, payload)).toEqual([]);
      expect(reportSchema.safeParse(payload).success, JSON.stringify(payload)).toBe(true);
    }
  });

  it('every payload the artifact rejects, Zod rejects too', () => {
    const hostile = [
      { type: 'bug' },
      { title: 't' },
      { type: 'question', title: 't' },
      { type: 'bug', title: '' },
      { type: 'bug', title: 'x'.repeat(MAX_TITLE_CHARS + 1) },
      { type: 'bug', title: 't', severity: 'P0' },
      { type: 'bug', title: 't', user: { id: 'u_1', role: 'admin' } },
    ];
    for (const payload of hostile) {
      const artifactErrors = validate(artifact, payload);
      const zodResult = reportSchema.safeParse(payload);
      expect(artifactErrors.length, `artifact should reject ${JSON.stringify(payload)}`).toBeGreaterThan(0);
      expect(zodResult.success, `Zod should reject ${JSON.stringify(payload)}`).toBe(false);
    }
  });
});

describe('CA-01 contract: every published bound is the constant, not a copy of it', () => {
  it('the numeric limits in the artifact are exactly constants.ts (R-18)', () => {
    const properties = artifact.properties ?? {};

    expect(properties.title?.maxLength).toBe(MAX_TITLE_CHARS);
    expect(properties.title?.minLength).toBe(1);

    // `note`, `url` and each `user.*` field are `anyOf: [<constraint>, null]`.
    const constrained = (sub: JsonSchema | undefined): JsonSchema => {
      const branches = sub?.anyOf ?? [];
      const found = branches.find((branch) => branch.type !== 'null');
      if (found === undefined) throw new Error('expected a non-null anyOf branch');
      return found;
    };

    expect(constrained(properties.note).maxLength).toBe(MAX_NOTE_CHARS);
    expect(constrained(properties.url).maxLength).toBe(MAX_URL_PATH_CHARS);

    const userBranches = properties.user?.anyOf ?? [];
    const userObject = userBranches.find((branch) => branch.type === 'object');
    expect(userObject?.additionalProperties).toBe(false);
    expect(constrained(userObject?.properties?.id).maxLength).toBe(MAX_USER_ID_CHARS);
    expect(constrained(userObject?.properties?.name).maxLength).toBe(MAX_USER_NAME_CHARS);
    expect(constrained(userObject?.properties?.email).maxLength).toBe(MAX_USER_EMAIL_CHARS);
  });
});
