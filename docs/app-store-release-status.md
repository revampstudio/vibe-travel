# App Store Release Status

Last updated: 28 May 2026

## App

- Installed app name: Vibe Travel
- App Store listing name: `Vibe Travel Map`
- App Store Connect app ID: `6773780596`
- Bundle ID: `com.mitchellrben.vibetravelmobile`
- Expo/EAS project: `@mitchellrben/vibe-travel-mobile`
- Category: Travel, secondary Lifestyle
- Privacy policy: `https://vibe-travel-advisory-api.mitchellrbenjamin.workers.dev/privacy`
- Support/contact email: `mitchell@revampstudio.com.au`

## Local Prep Completed

- Added iOS bundle identifier to `apps/mobile/app.json`.
- Switched Expo iOS/global icon to `apps/mobile/assets/brand/app-icon-1024.png`.
- Set `ios.supportsTablet` to `false` so the first App Store submission can be iPhone-only.
- Created App Store screenshot uploads in `apps/mobile/store-assets/app-store-upload/`.
- Added `apps/mobile/store.config.json` for EAS Metadata.

## App Store Connect / EAS Completed

- EAS iOS production build completed:
  - Build ID: `b45728f0-ed07-46e2-8fce-c66ee02dd1b3`
  - Version: `0.1.0`
  - Build number: `4`
  - Logs: `https://expo.dev/accounts/mitchellrben/projects/vibe-travel-mobile/builds/b45728f0-ed07-46e2-8fce-c66ee02dd1b3`
- Bundle ID registered with Apple: `com.mitchellrben.vibetravelmobile`.
- App Store Connect app record created.
- Exact App Store name `Vibe Travel` was unavailable, so the listing metadata uses `Vibe Travel Map`.
- TestFlight group created by EAS: `Team (Expo)`.
- Internal TestFlight access enabled for `mitchell@revampstudio.com.au`.
- App Store Connect API key created for EAS Submit:
  - Key ID: `NU2378MH2W`
  - Role: App Manager
- EAS submission scheduled:
  - Submission ID: `3dda50ff-a277-40bf-91d7-edd08143d300`
  - Submission URL: `https://expo.dev/accounts/mitchellrben/projects/vibe-travel-mobile/submissions/3dda50ff-a277-40bf-91d7-edd08143d300`
  - Status: succeeded. Build `0.1.0 (4)` uploaded to App Store Connect.
- EAS Metadata pushed successfully to App Store Connect:
  - Version/release info
  - English (U.S.) localized listing
  - App categories
  - Age rating declaration
  - Privacy policy URL
- App Store screenshots uploaded:
  - 6.5" display slot has 4 screenshots from `apps/mobile/store-assets/app-store-upload/`.
  - On 28 May 2026, the version was removed from review, the 6.5" screenshots were replaced with the regenerated `1284x2778` preview set, and the version was resubmitted.
- App Privacy completed and published in App Store Connect:
  - Data types declared: Product Interaction, Search History, Device ID.
  - Data linked to user/device: Usage Data, Search History, Identifiers.
  - Tracking: No.
- Pricing and availability completed:
  - Price: free (`$0.00`).
  - Availability: all 175 countries or regions on app release.
  - Apple Silicon Mac and Apple Vision Pro opt-ins disabled for this iPhone release.
- Build `0.1.0 (4)` attached to the App Store version.
- App Review sign-in requirement disabled.
- App Review contact details and review notes saved.
- Content Rights Information saved:
  - `Yes, this app has the necessary rights to its third-party content.`
- Submitted App Store version `0.1.0` build `4` for App Review.
  - App Store Connect reported: `1 Item Submitted`.
  - Apple review estimate shown: up to 48 hours.
- Resubmitted App Store version `0.1.0` build `4` for App Review after the screenshot refresh.
  - App Store Connect reported: `1 Item Submitted`.
  - Current status after resubmission: `Waiting for Review`.

## App Store Listing Copy Draft

### Subtitle

Travel ideas by birth details

### Promotional Text

Explore destination ideas shaped by birth date, birth time, city context, travel advisories, and local activity options.

### Description

Vibe Travel turns your birth details into a personal travel map.

Add your birthday, birth time, and birth city to see destination ideas shaped by numerology, planetary lines, travel context, and local activity options. Explore a world map, compare suggested cities, and open detailed city pages with alignment notes, advisory context, and things to do.

Use Vibe Travel to:

- Build a personal map from your birth details.
- Discover cities that match your current personal year.
- Compare destination notes, planetary influences, and travel advisories.
- Browse activity ideas for selected cities.

Vibe Travel is designed for exploration and reflection. Travel advisory and activity information can change, so always check official sources before booking or travelling.

### Keywords

travel,trip planner,destinations,map,numerology,astrology,city guide,travel ideas

### Review Notes

No account or login is required. The app asks for birth date, birth time, and birth city to generate destination recommendations. The app does not request current device location.

## App Privacy Draft

Use the live app/privacy-policy state as the source of truth when filling App Store Connect.

- Birth date, birth time, and birth city are stored locally on device.
- No account is required.
- The app does not ask for name, email, phone number, contacts, photos, or current device location.
- Mapbox is used for city search/geocoding and maps.
- PostHog analytics may collect app interactions, search history, and device identifiers when configured.
- Viator links/activity data may involve third-party services.

## Remaining Steps

1. Watch for Apple review result email.
2. If approved, manually release this version in App Store Connect.
