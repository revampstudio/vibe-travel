import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import { PLANET_COLORS, PLANETS } from '../lib/astrocartography.ts'
import { ENERGY_TIERS, LINE_TYPE_STYLES } from '../lib/mapGuidance.ts'

export default function MapKey() {
  const view = useStore((s) => s.view)
  const enabledPlanets = useStore((s) => s.enabledPlanets)
  const [open, setOpen] = useState(false)

  const visiblePlanets = useMemo(
    () => PLANETS.filter((planet) => enabledPlanets.has(planet)),
    [enabledPlanets],
  )

  return (
    <div className={`absolute z-[31] hidden md:block ${view === 'detail' ? 'lg:bottom-6 lg:left-6' : 'md:bottom-6 md:right-6'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="floating-control flex min-h-[44px] h-11 items-center gap-2 px-3.5 text-sm font-semibold text-text transition-colors hover:border-border-strong hover:bg-white"
        aria-expanded={open}
        aria-controls="map-key-panel"
      >
        <svg className="size-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        Map Key
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            id="map-key-panel"
            className="floating-panel absolute bottom-[3.25rem] right-0 w-[19.5rem] space-y-4 p-4 md:w-[21rem]"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                Dot Color = Energy
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {ENERGY_TIERS.map((tier) => (
                  <div key={tier.id} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full border border-white/70"
                      style={{ backgroundColor: tier.color }}
                    />
                    <span className="text-xs tabular-nums text-text">
                      {tier.label} <span className="text-muted">{tier.rangeLabel}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                Line Color = Planet
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {visiblePlanets.map((planet) => (
                  <div key={planet} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full border border-white/70"
                      style={{ backgroundColor: PLANET_COLORS[planet] }}
                    />
                    <span className="text-xs text-text">{planet}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                Line Style = Angle
              </p>
              <div className="space-y-2">
                {LINE_TYPE_STYLES.map((style) => (
                  <div key={style.lineType} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text">
                        {style.lineType} · {style.label}
                      </p>
                      <p className="text-[11px] text-muted">{style.context}</p>
                    </div>
                    <svg className="flex-shrink-0" width="58" height="8" viewBox="0 0 58 8" aria-hidden="true">
                      <line
                        x1="0"
                        y1="4"
                        x2="58"
                        y2="4"
                        stroke="#4B5563"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={style.legendDasharray}
                      />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
