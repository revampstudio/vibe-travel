import { motion } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import type { Planet } from '../types/index.ts'

const PLANET_META: { planet: Planet; color: string }[] = [
  { planet: 'Sun', color: '#F9A825' },
  { planet: 'Moon', color: '#78909C' },
  { planet: 'Mercury', color: '#00ACC1' },
  { planet: 'Venus', color: '#E84393' },
  { planet: 'Mars', color: '#E53935' },
  { planet: 'Jupiter', color: '#6C5CE7' },
  { planet: 'Saturn', color: '#A67C52' },
]

export default function PlanetLegend() {
  const enabledPlanets = useStore((s) => s.enabledPlanets)
  const togglePlanet = useStore((s) => s.togglePlanet)

  return (
    <motion.div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl px-2 py-2 shadow-sm border border-border/60
                      flex items-center gap-0.5">
        {PLANET_META.map(({ planet, color }) => {
          const enabled = enabledPlanets.has(planet)
          return (
            <button
              key={planet}
              onClick={() => togglePlanet(planet)}
              aria-label={`${enabled ? 'Hide' : 'Show'} ${planet} lines`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all cursor-pointer
                          min-h-[44px]
                          ${enabled
                            ? 'bg-surface'
                            : 'opacity-35 hover:opacity-70'}`}
            >
              <div
                className="size-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-text text-sm font-medium">{planet}</span>
            </button>
          )
        })}

      </div>
    </motion.div>
  )
}
