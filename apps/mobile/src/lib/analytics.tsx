import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'expo-router'
import type { PostHogEventProperties } from '@posthog/core'
import PostHog, { PostHogProvider } from 'posthog-react-native'

import type { CityWithEnergy } from '@/src/types'
import { cityKey } from '@/src/utils/cityKey'

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim()
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'

export const analyticsEnabled = Boolean(POSTHOG_API_KEY)

export const posthog = POSTHOG_API_KEY
  ? new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    captureAppLifecycleEvents: true,
    enableSessionReplay: false,
  })
  : null

type AnalyticsEvent =
  | 'onboarding_step_viewed'
  | 'birth_city_selected'
  | 'onboarding_completed'
  | 'map_viewed'
  | 'settings_updated'
  | 'utility_panel_opened'
  | 'utility_panel_closed'
  | 'city_selected'
  | 'city_detail_viewed'
  | 'city_detail_closed'
  | 'activity_link_opened'
  | 'insights_tab_viewed'

export function track(event: AnalyticsEvent, properties?: PostHogEventProperties) {
  if (!posthog) return
  void posthog.capture(event, properties)
}

export function screen(name: string, properties?: PostHogEventProperties) {
  if (!posthog) return
  void posthog.screen(name, properties)
}

export function cityAnalyticsProperties(city: CityWithEnergy): PostHogEventProperties {
  return {
    city_key: cityKey(city),
    city_name: city.name,
    country: city.country,
    active_line_count: city.activeLines.length,
    energy_score_bucket: Math.round(city.energyScore * 10) / 10,
  }
}

function RouteTracker() {
  const pathname = usePathname()

  useEffect(() => {
    screen(pathname === '/' ? 'home' : pathname, { pathname })
  }, [pathname])

  return null
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  if (!posthog) return <>{children}</>

  return (
    <PostHogProvider
      client={posthog}
      autocapture={{
        captureScreens: false,
        captureTouches: false,
      }}
    >
      <RouteTracker />
      {children}
    </PostHogProvider>
  )
}
