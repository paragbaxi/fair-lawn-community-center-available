import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scraper/**/*.test.ts', 'scripts/**/*.test.ts'],
    env: { TZ: 'America/New_York' },
  },
});
