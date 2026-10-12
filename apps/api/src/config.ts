import {
  RATE_LIMIT_PER_IP_PER_MIN,
  RATE_LIMIT_PER_KEY_PER_MIN,
  RATE_LIMIT_PER_PROJECT_PER_DAY,
  TTL_ARTIFACT_DAYS,
  TTL_IDENTITY_DAYS,
} from '@watchbug/contracts/constants';

/**
 * Server configuration — load once at boot and fail fast (P1-D-02, SEC-04,
 * DEP-02).
 *
 * Env values reach this module through Node's `--env-file` (no `dotenv`, see
 * STACK.md rejection list) or through the compose `env_file:`/`environment:`
 * entries. The precedence contract — real process env wins over the file, the
 * last duplicate key in the file wins, empty means empty — is documented in
 * `.env.example` and is exactly what `--env-file` implements.
 *
 * Failure policy: **exit non-zero with a message that names the exact variable
 * and the `.env` file**, so a misconfigured instance never serves traffic.
 */

/** Documented sample key — rejected exactly like a missing value (P1-D-02). */
export const PLACEHOLDER_PROJECT_KEY = 'wkbt_00000000000000000000000000000000';

/** P1-D-03: `wkbt_` + exactly 32 base62 characters ([0-9A-Za-z], ~190 bits). */
export const PROJECT_KEY_PATTERN = /^wkbt_[0-9A-Za-z]{32}$/;

const ENV_FILE = '.env';
const DEFAULT_DATA_DIR = './data';

export interface AppConfig {
  projectKey: string;
  databaseUrl: string;
  corsOrigins: string[];
  ttlIdentityDays: number;
  ttlArtifactDays: number;
  rateLimitPerKeyPerMin: number;
  rateLimitPerIpPerMin: number;
  rateLimitPerProjectPerDay: number;
  dataDir: string;
  port: number;
  /** Listen address — loopback for host dev, `0.0.0.0` inside the api container (nginx reaches it by service name). */
  host: string;
  trustProxy: boolean;
}

function fatal(message: string): never {
  console.error(`[watchbug] FATAL: ${message}`);
  process.exit(1);
}

function readString(env: Record<string, string | undefined>, name: string): string | undefined {
  const raw = env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

function readInt(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
): number {
  const raw = readString(env, name);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    fatal(
      `${name} in ${ENV_FILE} must be a positive integer (got "${env[name]}"). ` +
        `Set it to a positive number or leave it empty to use the documented default ${fallback}.`,
    );
  }
  return Number(raw);
}

function readBool(env: Record<string, string | undefined>, name: string, fallback: boolean): boolean {
  const raw = readString(env, name);
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  fatal(`${name} in ${ENV_FILE} must be "true" or "false" (got "${env[name]}").`);
}

function readProjectKey(env: Record<string, string | undefined>): string {
  const raw = env.WATCHBUG_PROJECT_KEY;
  // Missing and empty-string behave identically (DEP-02 empty edge).
  if (raw === undefined || raw.trim() === '') {
    fatal(
      'WATCHBUG_PROJECT_KEY is missing or empty. ' +
        `Set it in ${ENV_FILE} (copy .env.example to ${ENV_FILE}) and generate a real key with "npm run key:gen".`,
    );
  }
  const key = raw.trim();
  if (key === PLACEHOLDER_PROJECT_KEY) {
    fatal(
      `WATCHBUG_PROJECT_KEY in ${ENV_FILE} is the documented placeholder sample and is not a usable key. ` +
        `Generate a real one with "npm run key:gen".`,
    );
  }
  if (!PROJECT_KEY_PATTERN.test(key)) {
    fatal(
      `WATCHBUG_PROJECT_KEY in ${ENV_FILE} has the wrong format: expected "wkbt_" plus exactly 32 ` +
        `base62 characters [0-9A-Za-z] (got "${key.length > 40 ? `${key.slice(0, 40)}…` : key}"). ` +
        `Generate a valid key with "npm run key:gen".`,
    );
  }
  return key;
}

function readDataDir(env: Record<string, string | undefined>): string {
  const raw = readString(env, 'WATCHBUG_DATA_DIR');
  if (raw === undefined) return DEFAULT_DATA_DIR;
  if (raw.startsWith('~')) {
    fatal(`WATCHBUG_DATA_DIR in ${ENV_FILE} must be an absolute or relative path (got "${env.WATCHBUG_DATA_DIR}").`);
  }
  return raw;
}

/** Loads and validates the whole server configuration, exiting loudly on any problem. */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const databaseUrl = readString(env, 'DATABASE_URL');
  if (databaseUrl === undefined) {
    fatal(
      'DATABASE_URL is missing or empty. ' +
        `Set it in ${ENV_FILE} (copy .env.example to ${ENV_FILE}); see the Database section of .env.example.`,
    );
  }

  const corsRaw = readString(env, 'WATCHBUG_CORS_ORIGINS');
  const corsOrigins = corsRaw === undefined ? [] : corsRaw.split(',').map((o) => o.trim()).filter(Boolean);

  return {
    projectKey: readProjectKey(env),
    databaseUrl,
    corsOrigins,
    ttlIdentityDays: readInt(env, 'WATCHBUG_TTL_IDENTITY_DAYS', TTL_IDENTITY_DAYS),
    ttlArtifactDays: readInt(env, 'WATCHBUG_TTL_ARTIFACT_DAYS', TTL_ARTIFACT_DAYS),
    rateLimitPerKeyPerMin: readInt(env, 'WATCHBUG_RATE_LIMIT_PER_KEY_PER_MIN', RATE_LIMIT_PER_KEY_PER_MIN),
    rateLimitPerIpPerMin: readInt(env, 'WATCHBUG_RATE_LIMIT_PER_IP_PER_MIN', RATE_LIMIT_PER_IP_PER_MIN),
    rateLimitPerProjectPerDay: readInt(
      env,
      'WATCHBUG_RATE_LIMIT_PER_PROJECT_PER_DAY',
      RATE_LIMIT_PER_PROJECT_PER_DAY,
    ),
    dataDir: readDataDir(env),
    port: readInt(env, 'PORT', 3000),
    host: readString(env, 'WATCHBUG_HOST') ?? '127.0.0.1',
    trustProxy: readBool(env, 'WATCHBUG_TRUST_PROXY', false),
  };
}
