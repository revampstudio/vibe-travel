import { useEffect } from 'react'
import { loadCities } from '@/src/data/loadCities'
import { computeAstroLines } from '@/src/lib/astrocartography'
import { enrichCitiesWithEnergy } from '@/src/lib/geo'
import { calcSoulProfile } from '@/src/lib/numerology'
import { migrateLegacyBirthData } from '@/src/lib/migrateBirthData'
import { useStore } from '@/src/store/useStore'

export function AppBootstrap() {
  const birthData = useStore((state) => state.birthData)
  const cities = useStore((state) => state.cities)
  useEffect(() => {
    if (!birthData || cities.length > 0) return
    let cancelled = false
    const migration = migrateLegacyBirthData(birthData)
    if (migration.migrated) {
      useStore.getState().setBirthTimeNotice({ needsReview: false, message: 'Your saved map has been corrected for your birth city’s historical time zone. Your recorded birth details are unchanged; some planetary lines may move.' })
      useStore.getState().setBirthData(migration.birthData)
      return
    }
    if (migration.needsReview) {
      useStore.getState().setBirthTimeNotice({ needsReview: true, message: 'Please confirm your saved birth time before we update your map. An old noon placeholder or a clock change needs your choice.' })
      useStore.getState().setProfile(calcSoulProfile(birthData.date))
      useStore.getState().setActiveUtilityPanel('settings')
      useStore.getState().setView('globe')
      return
    }
    const rehydrate = async () => {
      const profile = calcSoulProfile(birthData.date)
      const astroLines = computeAstroLines(birthData.date, birthData.time, birthData.utcOffsetMinutes)
      const sourceCities = await loadCities()
      if (cancelled) return
      useStore.getState().setProfile(profile)
      useStore.getState().setAstroLines(astroLines)
      useStore.getState().setCities(enrichCitiesWithEnergy(sourceCities, astroLines))
      if (useStore.getState().view === 'loading') useStore.getState().setView('globe')
    }
    void rehydrate()
    return () => { cancelled = true }
  }, [birthData, cities.length])
  return null
}
