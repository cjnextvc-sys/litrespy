# PROJECT_STATUS.md — Litrespy

## Current State
Static HTML/CSS/JS marketing site + UI shell for a fuel price comparison app targeting QLD & NSW, Australia.

**Live URL:** Not yet deployed (local only)

## What's Built
- `index.html` — Full landing page with hero, search widget, fuel types, locations, brands, FAQ, alerts CTA
- `fuel-map.html` — Interactive Leaflet map (UI shell, no live data yet)
- `alerts.html` — Price alert signup page (UI only, no backend)
- `locations.html` — Suburb browsing page
- `blog.html`, `calculators.html`, `about.html`, `privacy.html` — Supporting pages
- `rewards.js` / `rewards.css` — Gamification system (coins, XP, streaks, missions, spin wheel) — localStorage only
- Brand logos in `images/brands/`

## Known Issues
- No real fuel data API connected — site is a UI shell
- Price alerts don't work — `activateAlert()` shows a fake browser dialog
- Ticker shows hardcoded static prices
- No backend (needed for email alerts)

## Recent Progress
- 2026-06-15: Initialized git repo, created PROJECT_STATUS.md + TODO.md, fixed NSW link bug, deployed to Netlify

## Next Priorities
1. Connect QLD FuelCheck API + NSW FuelCheck API to fuel-map.html
2. Set up email alert backend (Resend / Brevo free tier)
3. Make ticker show real data
