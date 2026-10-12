#!/usr/bin/env node
import { randomBytes } from 'node:crypto';

/**
 * `npm run key:gen` — prints a fresh Watchbug public project key (P1-D-03):
 * `wkbt_` + exactly 32 base62 characters (~190 bits).
 *
 * Rejection sampling, not naive modulo: `byte % 62` maps 256 values onto 62
 * buckets unevenly (values 0..53 occur 5×, 54..61 occur 4×), which would skew
 * the key distribution. 62 × 4 = 248, so bytes ≥ 248 are discarded and the
 * remaining 0..247 map uniformly onto the 62-symbol alphabet (4 full cycles).
 *
 * Randomness source: `crypto.randomBytes` (never `Math.random` — banned repo-wide).
 */

const PREFIX = 'wkbt_';
const LENGTH = 32;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const REJECT_AT = ALPHABET.length * 4; // 248

function base62(bytes) {
  let out = '';
  for (const byte of bytes) {
    if (byte >= REJECT_AT) continue; // biased bucket — discard and resample
    out += ALPHABET[byte % ALPHABET.length];
    if (out.length === LENGTH) break;
  }
  return out;
}

let key = '';
while (key.length < LENGTH) {
  key += base62(randomBytes(LENGTH * 2));
}

console.log(PREFIX + key);
