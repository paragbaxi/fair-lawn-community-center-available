/**
 * QA global teardown — summarises artifact paths and optionally cleans up.
 *
 * By default, artifacts in .qa-runs/ are KEPT so you can review them.
 * Set QA_CLEAN=1 env var to auto-delete after a successful run.
 *
 *   QA_CLEAN=1 npx playwright test --config=playwright.qa.config.ts
 */
import fs from 'fs';
import path from 'path';

export default async function teardown() {
  const qaDir = path.join(process.cwd(), '.qa-runs');

  if (!fs.existsSync(qaDir)) return;

  // List videos and screenshots for the user
  const artifacts: string[] = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(webm|png|jpg)$/.test(entry.name)) {
        artifacts.push(path.relative(process.cwd(), full));
      }
    }
  }
  walk(qaDir);

  console.log(`\n📁 QA artifacts in .qa-runs/ (${artifacts.length} files):`);
  for (const f of artifacts) {
    console.log(`   ${f}`);
  }
  console.log(`\n📊 Report: npx playwright show-report .qa-runs/report`);

  if (process.env.QA_CLEAN === '1') {
    fs.rmSync(qaDir, { recursive: true, force: true });
    console.log('🧹 .qa-runs/ cleaned (QA_CLEAN=1)');
  }
}
