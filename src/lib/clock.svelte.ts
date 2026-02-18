import { getEasternNow } from './time.js';

// Module-level $state object: ES module singleton — all importers share the same reactive cell.
// Property mutation (clock.now = ...) is allowed for exported $state; variable reassignment is not.
// The interval is always-on; SPA lifecycle means no cleanup needed.
export const clock = $state({ now: getEasternNow() });

setInterval(() => {
  clock.now = getEasternNow();
}, 60_000);
