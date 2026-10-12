import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { reportSchema } from '../src/schema.ts';

/**
 * Emits the published CA-01 artifact `schema/report.schema.json` (repo root).
 *
 * Generated and committed — never hand-written, and never produced by the
 * deprecated `zod-to-json-schema` converter (STACK.md "What NOT To Use"):
 * Zod 4 emits JSON Schema natively, so the schema and the artifact cannot drift.
 *
 * `../src/schema.ts` is imported directly: Node ≥ 24 strips types natively, and
 * the contracts sources use explicit `.ts` relative specifiers so the graph
 * resolves without a loader.
 */
const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, '..', '..', '..', 'schema', 'report.schema.json');

const json = z.toJSONSchema(reportSchema, { target: 'draft-2020-12' });

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(json, null, 2)}\n`);

console.log(`emitted ${outFile} (${Object.keys(json.properties ?? {}).length} properties)`);
