import { useLocalSearchParams } from 'expo-router'
import { Stack } from 'expo-router/stack'

import { CityDetailScreen } from '@/src/components/city-detail-screen'
import { useStore } from '@/src/store/useStore'

export default function CityDetailRoute() {
  const params = useLocalSearchParams<{ cityKey?: string | string[] }>()
  const encodedCityKey = Array.isArray(params.cityKey) ? params.cityKey[0] : params.cityKey
  const decodedCityKey = encodedCityKey ? decodeURIComponent(encodedCityKey) : ''

  const birthData = useStore((state) => state.birthData)
  const cities = useStore((state) => state.cities)
  const city = useStore((state) => state.cities.find((entry) => `${entry.name}|${entry.country}` === decodedCityKey) ?? null)
  const isHydrating = Boolean(birthData) && cities.length === 0

  return (
    <>
      <Stack.Screen options={{ title: isHydrating ? 'Loading City' : (city?.name ?? 'City Details') }} />
      <CityDetailScreen city={city} isHydrating={isHydrating} />
    </>
  )
}
