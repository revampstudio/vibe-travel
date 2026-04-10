import { useEffect } from 'react'

import { loadCities } from '@/src/data/loadCities'
import { computeAstroLines } from '@/src/lib/astrocartography'
import { enrichCitiesWithEnergy } from '@/src/lib/geo'
import { calcSoulProfile } from '@/src/lib/numerology'
import { useStore } from '@/src/store/useStore'

export function AppBootstrap() {
  const birthData = useStore((state) => state.birthData)
  const cities = useStore((state) => state.cities)

  useEffect(() => {
    if (!birthData || cities.length > 0) return

    const rehydrate = async () => {
      const profile = calcSoulProfile(birthData.date)
      const astroLines = computeAstroLines(birthData.date, birthData.time)
      const sourceCities = await loadCities()
      const enrichedCities = enrichCitiesWithEnergy(sourceCities, astroLines)

      useStore.getState().setProfile(profile)
      useStore.getState().setAstroLines(astroLines)
      useStore.getState().setCities(enrichedCities)
      if (useStore.getState().view === 'loading') {
        useStore.getState().setView('globe')
      }
    }

    void rehydrate()
  }, [birthData, cities.length])

  return null
}
