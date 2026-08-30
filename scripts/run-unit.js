#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const result = spawnSync('npx', ['vitest', 'run'], {
  stdio: 'inherit',
  cwd: projectRoot,
  shell: true,
});
process.exit(result.status ?? 1);
