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

## Activity data model

Every activity object stored in `localStorage` has these fields:

```
id, type, emoji, title, location, lat, lng, mapsUrl,
startTime, endTime, cost, currency, booked, notes, audioCue
```

## CSV columns — keep these three in sync at all times

Whenever a field is **added or removed** from the activity data model, update **all three** of these together:

1. **`CSV_HEADERS`** — per-trip export/import header row
2. **`ALL_CSV_HEADERS`** — all-trips export/import header row (prepends Trip/TripStart/TripEnd/TripCurrency)
3. **`downloadSampleCSV` → `tripRows`** — sample data array (column count must match `CSV_HEADERS`)

Also update the matching row builders (`tripToCSVRows`, `allTripsToCSVRows`) and both importers (`importTripCSV`, `importAllCSV`).
