# Backlog

## Done

### ~~P1: Improve timeline bar segment contrast in dark mode~~
Bumped past segment opacity (open-gym 0.3→0.45, scheduled 0.25→0.4). Deployed 2026-02-15.

### ~~P1: Add PWA support (install to home screen)~~
Added manifest.json, service worker, and app icons. Deployed 2026-02-15.

### ~~P2: Unofficial disclaimer with link to official site~~
Added disclaimer paragraph in footer with link to Borough of Fair Lawn. Deployed 2026-02-15.

### ~~P2: Auto-refresh live data~~
Extracted loadSchedule() and added visibilitychange listener to refresh after 5+ min away. Deployed 2026-02-15.

### ~~P3: Mobile timeline list — show end times~~
Added end times with ndash separator, adjusted min-width and font-size. Deployed 2026-02-15.

## Open

### P2: Subtle activity emoji animations
Add small animated emoji/icons per activity type (e.g., basketball for FLAS Basketball, ping pong paddle for Table Tennis, shuttlecock for Badminton). Consider subtle animations like a gentle bounce, spin, or sway to add personality without being distracting. Consult UX design agent for best practices on micro-animations and icon selection.

### P3: Deployment cache busting
Vite build output uses hashed filenames for JS/CSS, but `index.html` itself gets cached by GitHub Pages CDN. Consider adding a service worker or cache-control headers to ensure users see updates promptly without needing a hard refresh.
