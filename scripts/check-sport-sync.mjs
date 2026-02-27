/**
 * check-sport-sync.mjs
 *
 * Verifies that sport IDs stay in sync across three sources:
 *   1. src/lib/filters.ts          — FILTER_CATEGORIES (excluding 'all' and 'open-gym')
 *   2. worker/index.ts             — SPORT_PATTERNS
 *   3. scripts/check-and-notify-logic.mjs — SPORT_PATTERNS
 *
 * Exit 0 — IDs match across all three sources.
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

const filtersTs  = readFileSync(join(root, 'src', 'lib', 'filters.ts'), 'utf-8');
const workerTs   = readFileSync(join(root, 'worker', 'index.ts'), 'utf-8');
const logicMjs   = readFileSync(join(root, 'scripts', 'check-and-notify-logic.mjs'), 'utf-8');

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
const NON_SPORT_IDS = new Set(['all', 'open-gym']);
const filterSportIds = allFilterIds.filter((id) => !NON_SPORT_IDS.has(id));

const workerSportIds = extractIds(workerTs);
const logicSportIds  = extractIds(logicMjs);

// ─── Three-way comparison ─────────────────────────────────────────────────────

const sources = [
  { label: 'src/lib/filters.ts (FILTER_CATEGORIES)',               ids: filterSportIds },
  { label: 'worker/index.ts (SPORT_PATTERNS)',                     ids: workerSportIds },
  { label: 'scripts/check-and-notify-logic.mjs (SPORT_PATTERNS)', ids: logicSportIds  },
];

const allIds = new Set(sources.flatMap((s) => s.ids));

let hasError = false;

for (const id of allIds) {
  const missing = sources.filter((s) => !s.ids.includes(id));
  if (missing.length === 0) continue;

  const present = sources.filter((s) => s.ids.includes(id));
  console.error(
    `ERROR: Sport ID '${id}' is present in:\n` +
      present.map((s) => `  ✓ ${s.label}`).join('\n') +
    `\nbut missing from:\n` +
      missing.map((s) => `  ✗ ${s.label}`).join('\n'),
  );
  hasError = true;
}

// ─── Report ───────────────────────────────────────────────────────────────────

if (hasError) {
  process.exit(1);
}

const ids = sources[0].ids;
console.log(`Sport IDs in sync across all 3 sources: [${ids.map((id) => `'${id}'`).join(', ')}]`);
process.exit(0);
