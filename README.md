# Vibe Travel

This repo now has two real projects:

- `apps/mobile`: the Expo application
- `worker`: the Cloudflare Worker that serves normalized travel advisories

The old Vite web app has been removed.

## Run the Expo app

Install dependencies once inside the Expo app:

```bash
cd apps/mobile
npm install
```

Then either run it there:

```bash
npm start
npm run web
```

Or use the root wrapper scripts:

```bash
npm run dev
npm run web
```

## Run the advisory worker

```bash
cd worker
npm install
npm run dev
```

Root wrappers are available for that too:

```bash
npm run worker:dev
```

## Local env

Create `apps/mobile/.env.local` if you want the Expo app to call a specific advisory API:

```bash
EXPO_PUBLIC_TRAVEL_API_BASE=http://127.0.0.1:8787
```

If that variable is unset, the Expo app falls back to bundled advisory data when needed.

## Repo notes

- API details: `docs/travel-advisory-api.md`
- Worker entrypoint: `worker/src/index.ts`
- Expo advisory client: `apps/mobile/src/lib/travelAdvisory.ts`
