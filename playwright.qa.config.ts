/**
 * QA playwright config — video recording + screenshot capture for manual QA runs.
 *
 * All artifacts (videos + screenshots) land in .qa-runs/ which is gitignored.
 * Run:  npx playwright test --config=playwright.qa.config.ts
 * View: npx playwright show-report .qa-runs/report
 *
 * Requires preview server running: npm run preview -- --port 4174
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const QA_DIR = path.join(process.cwd(), '.qa-runs');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/qa-*.spec.ts',
  timeout: 45000,
  use: {
    baseURL: 'http://localhost:4174',
    video: { mode: 'on', size: { width: 390, height: 844 } },
    screenshot: { mode: 'on', fullPage: false },
    viewport: { width: 390, height: 844 },
  },
  // No webServer — assumes preview already running on port 4174
  projects: [
    {
      name: 'chromium-qa',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: `${QA_DIR}/artifacts`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `${QA_DIR}/report`, open: 'never' }],
  ],
  globalTeardown: './e2e/qa-teardown.ts',
});
