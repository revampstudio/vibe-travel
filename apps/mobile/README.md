# Vibe Travel Mobile

Expo Router rewrite of the Vite web app, kept side-by-side so the existing web code remains untouched.

## Run

```bash
cd apps/mobile
npm install
npm start
```

Use `npm run android`, `npm run ios`, or `npm run web` for a direct target launch.

## Optional env

Create `apps/mobile/.env.local` for local API config:

```bash
EXPO_PUBLIC_TRAVEL_API_BASE=https://your-api.example.com
```

Expo web and native both render the Expo implementation. Native iOS and Android still use `react-native-maps`.

## Structure

- `app/`: Expo Router routes
- `src/components/`: native UI screens and platform-specific map card implementations
- `src/lib/`: shared numerology, astrocartography, ranking, wiki, and advisory logic
- `src/store/`: Zustand app state with SQLite-backed localStorage polyfill
- `src/data/`: bundled city dataset

## Verification

These checks were run after the migration:

```bash
npx tsc --noEmit
npx expo-doctor
npx expo export --platform web
```
