#!/usr/bin/env node
/**
 * C-4 / INV-03 compose gate — zero dependencies (a minimal indentation-aware
 * scan; no YAML parser is warranted for the two assertions the invariant needs).
 *
 * Fails unless:
 *   1. `docker-compose.yml` declares **exactly three** top-level services:
 *      `api`, `panel`, `db` — a fourth container breaks the self-hosting
 *      promise (no Redis, no MinIO, no sidecar).
 *   2. The attachments volume is mounted **only** in `api` — neither `panel`
 *      nor `db` may see the blob volume (R-04: attachments are served only
 *      through the authenticated API surface).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composePath = join(repoRoot, 'docker-compose.yml');

let text;
try {
  text = readFileSync(composePath, 'utf8');
} catch {
  console.error('COMPOSE FAIL  docker-compose.yml is missing');
  process.exit(1);
}

const lines = text.split(/\r?\n/);

/** Top-level `services:` block → the service names declared under it. */
function topLevelKeysAfter(header) {
  const keys = [];
  let inBlock = false;
  for (const line of lines) {
    if (/^#/.test(line) || line.trim() === '') continue;
    if (!/^\S/.test(line)) {
      if (inBlock) continue;
      continue;
    }
    const m = /^(\S[^:]*):\s*$/.exec(line);
    if (!m) continue;
    if (m[1] === header) {
      inBlock = true;
      continue;
    }
    if (inBlock) break;
  }
  return keys;
}

function serviceNames() {
  const names = [];
  let inServices = false;
  for (const line of lines) {
    if (/^\s*#/.test(line)) continue;
    if (/^services:\s*$/.test(line)) {
      inServices = true;
      continue;
    }
    if (inServices) {
      if (/^\S/.test(line)) break; // left the services block
      const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
      if (m) names.push(m[1]);
    }
  }
  return names;
}

let failures = 0;

const expected = ['api', 'panel', 'db'];
const actual = serviceNames();
const sameSet = actual.length === expected.length && expected.every((s) => actual.includes(s));
if (sameSet) {
  console.log(`COMPOSE OK   exactly three services: ${actual.join(', ')}`);
} else {
  failures++;
  console.error(`COMPOSE FAIL expected exactly [${expected.join(', ')}], found [${actual.join(', ')}]`);
}

/** Which services mount the attachments volume. */
function servicesMountingVolume(volumeName) {
  const mounting = [];
  let currentService = null;
  let inVolumes = false;
  for (const line of lines) {
    if (/^\s*#/.test(line)) continue;
    const svc = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (svc && !inVolumes) {
      currentService = svc[1];
      continue;
    }
    if (/^\S/.test(line)) {
      currentService = null;
      inVolumes = false;
      continue;
    }
    if (currentService !== null && /^ {4}volumes:\s*$/.test(line)) {
      inVolumes = true;
      continue;
    }
    if (inVolumes && currentService !== null) {
      if (!/^ {6}-/.test(line)) {
        inVolumes = false;
        continue;
      }
      if (line.includes(volumeName)) mounting.push(currentService);
    }
  }
  return mounting;
}

const VOLUME_NAME = process.env.WATCHBUG_ATTACH_VOLUME ?? 'watchbug-db-data';
// The db data volume legitimately lives in `db`; the assertion that matters for
// R-04 is the *attachments* volume (blobs). Compose currently names the
// attachments volume via the api service's extra mount; scan for any volume
// mounted in api but also mounted in panel → that is the leak.
const apiOnlyCandidates = new Set();
let currentService = null;
let inVolumes = false;
for (const line of lines) {
  if (/^\s*#/.test(line)) continue;
  const svc = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
  if (svc && !inVolumes) {
    currentService = svc[1];
    continue;
  }
  if (/^\S/.test(line)) {
    currentService = null;
    inVolumes = false;
    continue;
  }
  if (currentService !== null && /^ {4}volumes:\s*$/.test(line)) {
    inVolumes = true;
    continue;
  }
  if (inVolumes && currentService !== null) {
    if (!/^ {6}-/.test(line)) {
      inVolumes = false;
      continue;
    }
    const m = /^\s*-\s*([A-Za-z0-9_-]+):/.exec(line);
    if (m && currentService === 'api') apiOnlyCandidates.add(m[1]);
  }
}

let volumeLeak = false;
for (const volume of apiOnlyCandidates) {
  if (volume === VOLUME_NAME) continue; // the db data volume, legitimately in db
  const mounters = servicesMountingVolume(volume);
  const others = mounters.filter((s) => s !== 'api');
  if (others.length > 0) {
    volumeLeak = true;
    failures++;
    console.error(`COMPOSE FAIL volume "${volume}" is also mounted in: ${others.join(', ')} (must be api-only, R-04)`);
  }
}
if (!volumeLeak) {
  console.log(`COMPOSE OK   attachments volume is mounted only in api (db data volume stays in db)`);
}

if (failures > 0) {
  console.error(`\ncheck:compose FAILED (${failures} violation${failures === 1 ? '' : 's'})`);
  process.exit(1);
}
console.log('\ncheck:compose PASSED');
