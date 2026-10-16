# Vibe Travel 0.2.0 relaunch preparation

Status: implementation, web QA and critical native QA passed. The updated sharing privacy policy is live, and replacement signed production builds are running. Store submission/review remain outstanding. No app-store release or metadata publication is represented by this document.

## Request → implementation

Source: Astrocartography Chat ✨, 16–17 October 2026, Jackie’s relaunch requests.

| Request | Implemented behavior | Main evidence |
| --- | --- | --- |
| “maps can be shared with friends on Vibe Travel” | Share & compare exports a readable PNG map with a world outline and planetary legend. A separate portable VTM1 code opens the same calculated chart in Vibe Travel. Native uses the OS image/text share sheets; web shares supported files or downloads the PNG, and shares/copies selectable code. | `src/components/share-map-image.tsx`, `src/lib/mapPostcard.ts`, `src/lib/chartSharing.ts` |
| “overlay your chart with someone else’s” | Paste a friend’s code or calculate a consenting companion’s chart from their details. Main map and comparison map show owner planetary colours and companion navy dashes. Toggle and remove controls preserve the owner’s birth profile. Imported charts are kept only in session memory. | `src/components/together-screen.tsx`, both `world-map-card` implementations, store |
| “travel / live with someone” | Separate Travel together and Live together lenses use the same real planetary geometry for both people. Candidates require nearby lines for each person; the weaker proximity signal determines the shared ranking. Travel weights ASC/DSC; living weights IC/DSC. Every result names influences for each person and links to their fuller interpretations. No compatibility percentage is invented. | `src/lib/compareCharts.ts`, `src/components/together-screen.tsx` |
| “better descriptions … heavier on astrology” | All ten planets × four angles explain planetary symbolism, the angle, possibilities, tensions, visiting and longer stays. Insights starts with the astrocartography guide before numerology and travel ideas. | `src/lib/interpretations.ts`, Insights drawer |
| “travel recommendations go last” | City drawer and city route put planetary interpretations before city context/advisories and activities last. Insights opens Your astrology; Travel ideas is the second tab. Comparison explanations precede shared suggestions. | Dashboard, city detail and together screens |
| “couldn’t find … searching astrocartography” | Draft App Store/Play title, description and keywords explicitly use astrocartography. Version is 0.2.0 in Expo/store metadata. This improves relevance but does not promise ranking, store availability or search-indexing timing. | `store.config.json`, `store-assets/play-listing-draft.md`, `app.json` |

Paths in this table are under `apps/mobile` unless stated otherwise.

## Calculation and privacy decisions

- Existing `astronomy-engine` computations remain shared between ordinary maps and imported charts. Export encodes ten pairs of MC longitude and declination, with six decimal places; import regenerates all four angular lines through the same geometry functions. Export does not include a name, birth date/time/city or birthplace coordinates. Chart geometry remains personal information and is labelled accordingly.
- The previous code treated a local birth time as UTC. New profiles resolve birthplace coordinates to an IANA zone with `tz-lookup` and use Temporal for date-aware historical conversion, including daylight saving. Normal setup needs no manual offset. Repeated local clock times require choosing the recorded offset; skipped times reject. An advanced manual override is available. Returning profiles without an offset are automatically migrated when their recorded time resolves unambiguously, preserving their original date/time/city and showing a one-time correction notice. Unknown times, legacy noon placeholders and clock-change ambiguities open Settings for confirmation before generating or sharing a chart. Existing manual offsets are preserved.
- Unknown birth times use the existing noon approximation and are now explicitly marked approximate, including in shared map imagery/codes. Exact lines should not be inferred from an unknown time.
- Shared suggestions are symbolic exploration, not relationship synastry, compatibility scoring or a relocation guarantee. Known bundled Level 3–4 advisory countries are excluded. Advisory data may be stale; practical/current advice remains necessary and is stated in the UI.
- No server-side chart account, contact directory, automatic invitation or message sending was introduced. PNG files use the temporary cache on native and are removed after the share sheet returns. Companion raw form fields are cleared after calculation.
- Map postcard geography derives from Natural Earth’s public-domain 1:110m land data: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson . Attribution appears on the image.

## Local verification

From `apps/mobile`:

```sh
npm ci
npm run typecheck
npm test
VIBE_NO_WATCHMAN=1 EXPO_OFFLINE=1 npm run web:build -- --clear
VIBE_NO_WATCHMAN=1 EXPO_OFFLINE=1 npx expo start --web --port 8087
```

Use `--clear` after changing public environment variables: Metro can otherwise reuse transforms with an older token configuration.

`VIBE_NO_WATCHMAN=1` is an optional local/CI workaround for an unavailable Watchman service; it uses Metro’s filesystem crawler.

Thirteen focused tests currently pass: historical UTC/day rollover, fractional offsets, invalid dates/times, all real planetary angles and antimeridian bounds, share privacy and roundtrip, malformed code rejection, deterministic two-person/lens ranking, description coverage, image payload, actual historical IANA offsets, DST overlaps/gaps, legacy migration, and the synchronous hour-change/blur regression plus invalid time-entry preservation. TypeScript passes. The final production web export passed with the recovered app Mapbox configuration; runtime QA is tracked separately.

Native uses a development build, not Expo Go:

```sh
npx expo prebuild --no-install
npx expo run:android --device VibeTravelQA --no-bundler
# Or pod install / local iOS simulator build, then attach Metro:
VIBE_NO_WATCHMAN=1 EXPO_OFFLINE=1 npx expo start --dev-client --port 8087
```

`expo-sharing` is the only new native module. `tz-lookup` and `@js-temporal/polyfill` are pure JavaScript. Existing map SDK access still requires the app’s configured `EXPO_PUBLIC_MAPBOX_TOKEN`; write it to ignored `.env.local`, never to the repository. The map postcard works without a Mapbox token or network.

## Independent QA checklist

1. Fresh onboarding: date 1992-07-14, 08:35 local, Brisbane. Confirm UTC+10:00 is automatic and a map is created.
2. Check Sydney summer/winter offsets. For New York, 2020-11-01 01:30 requires a choice; 2020-03-08 02:30 must reject.
3. Read Insights and open a city. Astrology precedes travel ideas; activities are last.
4. Share PNG and view the actual received/downloaded image. Verify map/legend readability and omitted birth details. Cancel sharing without an error.
5. Copy the VTM1 code into another fresh session’s Share & compare page, without creating a profile. View the friend’s map. Reject incomplete/oversized/malformed codes with a useful message.
6. Create your own profile and import a different chart. Check owner profile survives import/replace/remove; distinguish navy companion lines; toggle overlay on both platforms.
7. Try both travel and live lenses. Read the two per-person explanations; inspect a result on the map; check no-overlap wording without compatibility inference.
8. Export a combined image. Confirm both maps and an approximation label when either chart is approximate.
9. On iOS/Android, verify real image/text share sheets, PNG attachment, no extra photo-library permission request, and that changing chart/time zone updates the displayed geometry.

## Release gates

- Independent Jackie-perspective runtime QA must pass on web and available native targets; record limitations rather than claiming untested platforms passed.
- Confirm Apple agreements/account access and current review status before submission. Store name availability must be checked during metadata submission.
- Confirm Google Play production eligibility and any testing requirements before promising a production launch.
- Use a fresh incremented native build number/versionCode through the existing EAS remote version workflow. Do not reuse previous store build identifiers.
- The privacy-policy source in `worker/src/index.ts` now describes deliberate image/code sharing, derived personal geometry, recipient copies, session-only companions and temporary-file retention. The policy was published after the native QA gate and both public aliases were verified before any app-store submission.
- Prepare current screenshots for Share & compare and richer descriptions; old store screenshots do not demonstrate these features.

## Privacy policy publication

Prepared and published on 17 October 2026 after the native QA gate:

- Existing Wrangler OAuth access can read the account and write Workers. Target: `vibe-travel-advisory-api`, account `88842855bd2af0776d9f5de7ef06ff1e`. No credentials, grants or resources were created.
- The prior active version was `f0c5b31c-2b18-4681-941b-11b15116d5e8` (17 May 2026); a fresh read immediately before publication confirmed it was unchanged. It is the rollback target. Its only binding is the existing `VIATOR_API_KEY` secret. Remote compatibility date is `2026-02-14`, matching the repository; compatibility flags and tail consumers are empty, Logpush is disabled, and no additional placement/observability settings were returned. Preserve these settings and the existing secret.
- Wrangler 4.124.0 dry-run passed: 313.35 KiB total, 55.99 KiB gzip. An initial build in the checkout stalled in a filesystem open; an exact copy of the tracked Worker source/config at `/tmp/vibe-policy-build` built successfully. The generated artifact is `/tmp/vibe-policy-dry-run/index.js`.
- The current deployed script was retrieved read-only and compared with the prepared bundle. All code outside `PRIVACY_POLICY_UPDATED` and `privacyPolicyResponse` is byte-for-byte identical. Both `/privacy` and `/privacy-policy` return HTTP 200 with the new sharing and retention text when invoked locally, without outbound requests.
- Deployment succeeded as version `edab8be6-14b7-4941-870f-3812c5a00b26`. Both `/privacy` and `/privacy-policy` return HTTP 200, the 17 October 2026 date and the sharing section. The health route and Japan advisory route also return HTTP 200. The exact release-script HTTP client passes with its explicit `VibeTravelReleasePreflight/1.0` user agent. Post-deployment inspection confirms the existing secret binding and `2026-02-14` compatibility date were preserved.

The authorized deployment used the prepared `/tmp/vibe-policy-build` directory:

```sh
CLOUDFLARE_ACCOUNT_ID=88842855bd2af0776d9f5de7ef06ff1e wrangler deploy --keep-vars --strict --message "Update Vibe Travel 0.2.0 sharing privacy policy"
```

`--keep-vars` preserves dashboard variables, and secrets are retained by deployment. `--strict` prevents silently overriding conflicting remote settings; see the [Wrangler deployment reference](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy). Do not change the compatibility date, bindings, routes or other runtime settings for this policy update. Verify the new date and sharing section at `https://vibe-travel-advisory-api.mitchellrbenjamin.workers.dev/privacy` and its `/privacy-policy` alias after publishing. If rollback is needed, the recorded active version above is the rollback target.

## Superseded production build preparation

On 17 October 2026, [EAS build `58a8a28e-d79b-48f9-8806-6e9939787cb2`](https://expo.dev/accounts/mitchellrben/projects/vibe-travel-mobile/builds/58a8a28e-d79b-48f9-8806-6e9939787cb2) started for Android production/STORE distribution from commit `4b95ba2e7e091a176da7e2ce23c9e81ffe954c8b`. This build was deliberately **CANCELED** after native iOS QA found an incorrect PNG export scale. It is superseded and must not be submitted or released. App version is `0.2.0`; EAS remote versionCode advanced from `16` to `17`. The package remains `com.mitchellrben.vibetravelmobile`.

- EAS reused the existing default Android keystore (`Build Credentials tuRCFhtvJb`) with `--freeze-credentials`. No keys, certificates or grants were created.
- Existing production EAS Mapbox configuration matches the recovered public app token. EAS also loaded the existing PostHog variables. The advisory API uses the existing default Worker URL. No environment variables needed changing.
- Existing Play service-account JSON is present at the submit profile's ignored `.secrets/play-store-service-account.json` path, validates structurally, and has mode `0600`. Its contents are not part of the repository/build archive.
- The account reported the Free plan, 0 of 15 Android builds used and 0 of 30 total builds used before starting. No upgrade or additional purchase was made.
- This is build preparation only. No EAS Submit, Play track update, rollout or store release has run. Native QA and the release gates above still apply; Google Play public production eligibility remains separate from an alpha test release.

Build command used from `apps/mobile`:

```sh
eas build --platform android --profile production --non-interactive --freeze-credentials --no-wait --message 'Vibe Travel 0.2.0 sharing, comparison and astrology relaunch; native QA gate pending'
```


The initial iOS production build, [EAS `e6b3357a-9023-4408-98e4-f9147c63a5b4`](https://expo.dev/accounts/mitchellrben/projects/vibe-travel-mobile/builds/e6b3357a-9023-4408-98e4-f9147c63a5b4), was also deliberately **CANCELED** for the same defect. It used version `0.2.0` / build `18` from commit `9620d37` with the existing certificate and provisioning profile under `--freeze-credentials`. No Apple credential or agreement was created or accepted. This job is superseded and must not be submitted or released.

The correction renders the native SVG at the export point size required by each device's pixel density and scales its on-screen preview independently. Independent iOS QA then opened the actual owner PNG (1440 × 1020, approximately 332 KB) and combined PNG (1440 × 1020, approximately 436 KB), confirming full map coverage, legible legend, companion dashes and subtitle. Returning/canceling retained both charts and the owner's exact 08:35 Brisbane profile. Independent Android QA also passed on the task Android 15 / API 35 emulator: actual owner and combined PNGs were 1440 × 1020 and readable; native Mapbox rendered; companion overlay toggled correctly; Travel suggested Rio Negro while Live suggested Polatlı; and the owner profile remained exactly 1992-07-14, 08:35, Brisbane, known time, UTC+10 after sharing/canceling. The task emulator’s Gboard stylus-handwriting mode required disabling for ordinary keyboard input; this was an emulator input configuration issue and required no app workaround. The replacement signed production jobs below use the fixed commit after this completed gate.


## Replacement signed production builds

Both builds were started after the completed web/iOS/Android critical QA gate from fixed source commit `7ed7eca1ac0b1491241bf7f8b46792c51ad69bd7`. App code remains frozen at that commit; subsequent changes to this release log do not change the reviewed app artifact.

| Platform | EAS build | Version | Status when recorded |
| --- | --- | --- | --- |
| Android | [35cc02da-149e-4ea9-a7f5-73d6ea9964bc](https://expo.dev/accounts/mitchellrben/projects/vibe-travel-mobile/builds/35cc02da-149e-4ea9-a7f5-73d6ea9964bc) | 0.2.0 (18) | IN_PROGRESS |
| iOS | [eb804ed7-53bd-4b21-afa7-8d210a146aec](https://expo.dev/accounts/mitchellrben/projects/vibe-travel-mobile/builds/eb804ed7-53bd-4b21-afa7-8d210a146aec) | 0.2.0 (19) | IN_PROGRESS |

Both use the existing production environment and frozen remote signing credentials. The quota check immediately before starting reported the Free plan, 0/15 builds used for each platform, 0/30 total and no estimated overage. No purchases, new credentials, permissions or production track changes were made.

The next Android step is to verify the successful AAB and obtain a fresh clear Play Publishing overview check, then update only the existing `alpha` track and `en-GB` listing in one validated edit. Preserve testers, countries, other tracks and listing fields; commit with `ERROR_IF_IN_REVIEW`. The upload response's SHA-256, when supplied, must match the downloaded artifact. For iOS, use the existing App Store Connect submission credentials if available; an unresolved Apple agreement may still prevent review or release and must not be accepted automatically.
