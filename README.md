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
npm run ios
npm run android
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
EXPO_PUBLIC_MAPBOX_TOKEN=pk.your_public_mapbox_token
EXPO_PUBLIC_TRAVEL_API_BASE=http://127.0.0.1:8787
```

Native iOS and Android now use Mapbox's native SDKs through `@rnmapbox/maps`, so the app should be run with a dev client or native run target rather than Expo Go. `npm start` in `apps/mobile` now starts Metro in dev-client mode.

If `EXPO_PUBLIC_TRAVEL_API_BASE` is unset, the Expo app falls back to bundled advisory data when needed.

## Android setup note

Android SDK setup was started locally but paused to avoid using mobile data.

Already installed locally:

- JDK 17 at `~/.local/opt/jdk-17.0.18+8`
- Android command-line tools at `~/Android/Sdk/cmdline-tools/latest`
- Android Emulator package

Still needed before `npm run android` will work:

- `platform-tools`
- `build-tools;35.0.1`
- `build-tools;36.0.0`
- `platforms;android-35`
- `platforms;android-36`
- `system-images;android-36;google_apis;x86_64`

Resume on Wi-Fi with:

```bash
source ~/.bashrc
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses
sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" \
  "build-tools;35.0.1" \
  "build-tools;36.0.0" \
  "platforms;android-35" \
  "platforms;android-36" \
  "system-images;android-36;google_apis;x86_64"
```

## Viator setup

Live city activities now come from the worker as well. Keep the Viator key on the worker side instead of exposing it in Expo env:

```bash
cd worker
wrangler secret put VIATOR_API_KEY
```

Optional worker vars:

```bash
VIATOR_CAMPAIGN_VALUE=your-campaign-slug
VIATOR_API_BASE=https://api.viator.com/partner
```

## Repo notes

- API details: `docs/travel-advisory-api.md`
- Worker entrypoint: `worker/src/index.ts`
- Expo advisory client: `apps/mobile/src/lib/travelAdvisory.ts`
