import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useStore } from './store/useStore.ts'
import { calcSoulProfile } from './lib/numerology.ts'
import { computeAstroLines } from './lib/astrocartography.ts'
import { loadCities } from './data/loadCities.ts'
import { enrichCitiesWithEnergy } from './lib/geo.ts'
import Onboarding from './components/Onboarding.tsx'
import GlobeMap from './components/GlobeMap.tsx'
import CityPanel from './components/CityPanel.tsx'
import SettingsPanel from './components/SettingsPanel.tsx'

export default function App() {
  const view = useStore((s) => s.view)
  const birthData = useStore((s) => s.birthData)

  // Rehydrate from sessionStorage when we have saved birth data
  useEffect(() => {
    if (view !== 'loading' || !birthData) return

    const rehydrate = async () => {
      const profile = calcSoulProfile(birthData.date)
      const astroLines = computeAstroLines(birthData.date, birthData.time)
      const cities = await loadCities()
      const enrichedCities = enrichCitiesWithEnergy(cities, astroLines)

      useStore.getState().setProfile(profile)
      useStore.getState().setAstroLines(astroLines)
      useStore.getState().setCities(enrichedCities)
      useStore.getState().setView('globe')
    }

    rehydrate()
  }, [view, birthData])

  return (
    <div className="w-full h-full relative bg-bg">
      <AnimatePresence mode="wait">
        {view === 'onboarding' && <Onboarding key="onboarding" />}
      </AnimatePresence>

      {(view === 'globe' || view === 'detail') && (
        <div className="w-full h-full relative">
          <GlobeMap />
          <SettingsPanel />
          <AnimatePresence>
            {view === 'detail' && <CityPanel key="city-panel" />}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
