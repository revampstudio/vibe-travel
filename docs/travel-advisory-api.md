# Australian Travel Advisory API

This project now includes a Cloudflare Worker adapter at `worker/` that normalizes Smartraveller advisories into a stable JSON contract for web and React Native clients.

## API contract

`GET /api/v1/travel-advisory?country=Japan`

Response:

```json
{
  "country": "Japan",
  "matchedCountry": "Japan",
  "adviceLevel": 2,
  "adviceLabel": "Exercise a high degree of caution",
  "summary": "Exercise a high degree of caution in Japan.",
  "updatedAt": "2026-02-10T13:44:00.000Z",
  "sourceUrl": "https://www.smartraveller.gov.au/destinations/asia/japan",
  "regionalAdvisories": [],
  "asOf": "2026-02-14T03:40:00.000Z",
  "freshness": "fresh"
}
```

## Worker behavior

- Source feed: `https://www.smartraveller.gov.au/destinations-export`
- Country matching: normalized names + aliases (`Burma -> Myanmar`, `Congo (Kinshasa) -> DRC`, etc.)
- Cache policy:
  - Snapshot refresh target: every 6 hours
  - Response cache header: `max-age=900, stale-while-revalidate=43200`
  - If upstream fails and cached data exists, API serves stale data with `"freshness": "stale"`

## Local development

1. Start worker:
   - `cd worker`
   - `npm install`
   - `npm run dev`
2. In web app `.env`, point frontend at worker:
   - `VITE_TRAVEL_API_BASE=http://127.0.0.1:8787`
3. Start web app from repo root:
   - `npm run dev`

Optional local source override for testing:

- `SMARTRAVELLER_EXPORT_URL=http://127.0.0.1:9090/fixtures/smartraveller.sample.json wrangler dev`

## Deployment

1. `cd worker`
2. `npm install`
3. `npm run deploy`
4. Set `VITE_TRAVEL_API_BASE` in your web app env to deployed worker URL.

Note: non-interactive deploy requires `CLOUDFLARE_API_TOKEN`.

## React Native / Expo reuse

Keep this API unchanged and call the same endpoint from Expo. Only UI and local storage differ on mobile; advisory logic and matching remain server-side.
