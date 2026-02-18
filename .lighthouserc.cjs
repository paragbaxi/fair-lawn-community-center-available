module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173/'],
      startServerCommand: 'npm run preview -- --port 4173',
      startServerReadyPattern: 'Local',   // matches Vite's "Local: http://localhost:4173/"
      numberOfRuns: 1,
      settings: {
        // Disable simulated throttling so scores reflect actual CI machine speed,
        // not a synthetic 4x CPU slowdown that makes shared runners score ~0.4.
        throttlingMethod: 'provided',
      },
    },
    assert: {
      assertions: {
        'categories:accessibility':  ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        // Bundle budget: ~2x current sizes (JS: 71 KB -> 150 KB, CSS: 21 KB -> 50 KB)
        'resource-summary:script:size':     ['error', { maxNumericValue: 150000 }],
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 50000 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
