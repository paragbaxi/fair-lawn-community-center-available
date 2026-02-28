import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: { baseURL: 'http://localhost:4173' },
  snapshotPathTemplate: '{testDir}/snapshots/{testFileName}/{arg}{ext}',
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    // VITE_WORKER_URL must be set so WORKER_URL is truthy in the built bundle.
    // Without it, OccupancyWidget.submitLevel() returns early and the pill never renders.
    env: { VITE_WORKER_URL: 'https://flcc-push.trueto.workers.dev' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/visual.spec.ts', '**/qa-*.spec.ts'],
    },
    {
      name: 'visual',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 390, height: 844 },
        animations: 'disabled',
      },
      testMatch: '**/visual.spec.ts',
    },
  ],
});
