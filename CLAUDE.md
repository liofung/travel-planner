# Travel Planner — Claude Guidelines

## Commit & Deploy permissions

Before committing or pushing to GitHub, **always ask the user for explicit confirmation**.

Do not auto-commit or auto-push, even if the user asks for changes to be "saved" or "published" — confirm the commit message and ask before running `git commit` or `git push`.

## Project overview

Single-file PWA: `app.js` (all logic), `style.css` (dark/light theme), `index.html` (shell).
Data persisted to `localStorage` key `travel-planner-v1`. No backend, no API keys.

## Key decisions already made

- **No Google OAuth / Client ID** — removed. CSV export/import only for Sheets interop.
- **No Leaflet** — uses Google Maps iframe embed (free, no key).
- **Native date inputs** — `<input type="date">`, not custom pickers.
- **Time selects** — 30-minute interval `<select>` dropdowns, not free-text.
- **PWA** — `manifest.json` + `sw.js` service worker, icons at `icon-192.png` / `icon-512.png`.

## Architecture

- `render()` rebuilds the whole screen; `attachHandlers()` wires up events after each render.
- `navigate(view, tripId?, dayId?)` sets `currentView` then calls `render()`.
- Timeline: 1px = 1 minute, `minsToY()` / `yToMins()` use `state.dayStartHour`.
- `state.theme`: `'light'` | `'dark'` | `undefined` (auto, follows OS).
