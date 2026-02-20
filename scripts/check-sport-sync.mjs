/**
 * check-sport-sync.mjs
 *
 * Verifies that sport IDs in src/lib/filters.ts (FILTER_CATEGORIES, excluding
 * 'all' and 'open-gym') stay in sync with SPORT_PATTERNS in
 * worker/index.ts.
 *
 * Exit 0 — IDs match.
 * Exit 1 — mismatch found; prints details.
 *
 * Uses only built-in Node.js modules (no npm install needed).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ─── Read files ───────────────────────────────────────────────────────────────

const filtersTs = readFileSync(join(root, 'src', 'lib', 'filters.ts'), 'utf-8');
const notifyMjs = readFileSync(join(root, 'worker', 'index.ts'), 'utf-8');

// ─── Extract IDs ──────────────────────────────────────────────────────────────

/**
 * Extract all { id: '...' } values from a source string.
 * Returns an array of ID strings in the order they appear.
 */
function extractIds(source) {
  const ids = [];
  const re = /\{\s*id:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

// All FILTER_CATEGORIES IDs from filters.ts
const allFilterIds = extractIds(filtersTs);

// Exclude 'all' and 'open-gym' — these are meta-categories, not sports.
// SPORT_CATEGORIES in filters.ts is defined as FILTER_CATEGORIES minus these two.
const NON_SPORT_IDS = new Set(['all', 'open-gym']);
const filterSportIds = allFilterIds.filter((id) => !NON_SPORT_IDS.has(id));

// SPORT_PATTERNS IDs from check-and-notify.mjs
const notifySportIds = extractIds(notifyMjs);

// ─── Compare ──────────────────────────────────────────────────────────────────

const filterSet = new Set(filterSportIds);
const notifySet = new Set(notifySportIds);

const missingFromNotify = filterSportIds.filter((id) => !notifySet.has(id));
const missingFromFilters = notifySportIds.filter((id) => !filterSet.has(id));

// ─── Report ───────────────────────────────────────────────────────────────────

let hasError = false;

if (missingFromNotify.length > 0) {
  console.error(
    `ERROR: Sport IDs in src/lib/filters.ts but missing from scripts/worker/index.ts SPORT_PATTERNS:\n` +
      missingFromNotify.map((id) => `  - '${id}'`).join('\n'),
  );
  console.error(
    `  Fix: add matching entries to SPORT_PATTERNS in worker/index.ts`,
  );
  hasError = true;
}

if (missingFromFilters.length > 0) {
  console.error(
    `ERROR: Sport IDs in scripts/worker/index.ts SPORT_PATTERNS but missing from src/lib/filters.ts FILTER_CATEGORIES:\n` +
      missingFromFilters.map((id) => `  - '${id}'`).join('\n'),
  );
  console.error(
    `  Fix: add matching entries to FILTER_CATEGORIES in src/lib/filters.ts`,
  );
  hasError = true;
}

if (hasError) {
  process.exit(1);
}

console.log(`Sport IDs in sync: [${filterSportIds.map((id) => `'${id}'`).join(', ')}]`);
process.exit(0);
