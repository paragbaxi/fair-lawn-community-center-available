# Backlog

## P1: Improve timeline bar segment contrast in dark mode
The horizontal timeline bar labels (desktop view) use white text on semi-transparent colored segments. Past segments drop to 25-30% opacity making labels nearly invisible in dark mode. Consider using a higher minimum opacity or switching to a different visual treatment for past segments (e.g. desaturated color instead of low opacity).

## P1: Add PWA support (install to home screen)
Add a `manifest.json` with app name, icons, and `display: standalone` so users can install the site to their phone's home screen for quick access. Pairs well with the existing `theme-color` meta tags.

## P2: Subtle activity emoji animations
Add small animated emoji/icons per activity type (e.g., basketball for FLAS Basketball, ping pong paddle for Table Tennis, shuttlecock for Badminton). Consider subtle animations like a gentle bounce, spin, or sway to add personality without being distracting. Consult UX design agent for best practices on micro-animations and icon selection.

## P2: Unofficial disclaimer with link to official site
Add a clear disclaimer that this is an unofficial community project, not affiliated with the Borough of Fair Lawn. Include a prominent link to the official Fair Lawn Community Center page (https://www.fairlawn.org/community-center) so users can verify schedule info directly.

## P2: Auto-refresh live data
The page loads schedule data once on page load. Add periodic polling (e.g. every 5 minutes) or a visibility-change listener to refetch `latest.json` so the status stays accurate for users who leave the tab open.

## P3: Deployment cache busting
Vite build output uses hashed filenames for JS/CSS, but `index.html` itself gets cached by GitHub Pages CDN. Consider adding a service worker or cache-control headers to ensure users see updates promptly without needing a hard refresh.

## P3: Mobile timeline list — show end times
The mobile vertical list view only shows start times (e.g. "2:00 PM — Open Gym"). Adding end times would match the weekly schedule detail level and help users plan without expanding the full schedule.
