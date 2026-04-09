import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store/useStore.ts'
import { calcSoulProfile } from './lib/numerology.ts'
import { computeAstroLines } from './lib/astrocartography.ts'
import { loadCities } from './data/loadCities.ts'
import { enrichCitiesWithEnergy } from './lib/geo.ts'
import Onboarding from './components/Onboarding.tsx'
import GlobeMap from './components/GlobeMap.tsx'
import CityPanel from './components/CityPanel.tsx'
import SettingsPanel from './components/SettingsPanel.tsx'
import RecommendationSidebar from './components/RecommendationSidebar.tsx'

export default function App() {
  const view = useStore((s) => s.view)
  const birthData = useStore((s) => s.birthData)
  const activeUtilityPanel = useStore((s) => s.activeUtilityPanel)
  const setActiveUtilityPanel = useStore((s) => s.setActiveUtilityPanel)

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

  useEffect(() => {
    if (!activeUtilityPanel) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveUtilityPanel(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeUtilityPanel, setActiveUtilityPanel])

  return (
    <div className="w-full h-full relative bg-bg">
      <AnimatePresence mode="wait">
        {view === 'onboarding' && <Onboarding key="onboarding" />}
      </AnimatePresence>

      {(view === 'globe' || view === 'detail') && (
        <div className="w-full h-full relative">
          <GlobeMap />
          <AnimatePresence>
            {activeUtilityPanel && (
              <motion.button
                key="utility-panel-backdrop"
                type="button"
                aria-label="Close open panel"
                className="absolute inset-0 z-[23] bg-[rgba(12,18,32,0.18)] backdrop-blur-[1px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setActiveUtilityPanel(null)}
              />
            )}
          </AnimatePresence>
          <SettingsPanel />
          <AnimatePresence>
            {(view === 'globe' || view === 'detail') && <RecommendationSidebar key="rec-sidebar" />}
          </AnimatePresence>
          <AnimatePresence>
            {view === 'detail' && <CityPanel key="city-panel" />}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
