# Vibe Travel Mobile

Expo Router application for Vibe Travel.

## Run

```bash
cd apps/mobile
npm install
npm start
```

Native now uses Mapbox's iOS and Android SDKs through `@rnmapbox/maps`, so Expo Go is no longer part of the native workflow.

Use these commands instead:

```bash
npm start
npm run ios
npm run android
npm run web
```

`npm start` now runs `expo start --dev-client`. `npm run ios` and `npm run android` create or launch native builds with the custom dev client.

## Optional env

Create `apps/mobile/.env.local` for native Mapbox and local API config:

```bash
EXPO_PUBLIC_MAPBOX_TOKEN=pk.your_public_mapbox_token
EXPO_PUBLIC_TRAVEL_API_BASE=https://your-api.example.com
```

Use the worker URL here for both travel advisories and live city activities.

## Native build flow

For local device or simulator work:

```bash
cd apps/mobile
npm install
npm run ios
# or
npm run android
```

Then attach Metro with:

```bash
npm start
```

For cloud dev-client builds:

```bash
eas build -p ios --profile development
eas build -p android --profile development
```

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
