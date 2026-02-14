import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import { getNumerologyNeeds, rankCitiesByNumerology } from '../lib/recommendations.ts'
import type { CityWithEnergy, Planet } from '../types/index.ts'

const PLANET_COLORS: Record<Planet, string> = {
  Sun: '#F9A825', Moon: '#78909C', Mercury: '#00ACC1', Venus: '#E84393',
  Mars: '#E53935', Jupiter: '#6C5CE7', Saturn: '#546E7A',
  Uranus: '#42A5F5', Neptune: '#7E57C2', Pluto: '#455A64',
}

export default function RecommendationSidebar() {
  const profile = useStore((s) => s.profile)
  const cities = useStore((s) => s.cities)
  const setSelectedCity = useStore((s) => s.setSelectedCity)
  const setView = useStore((s) => s.setView)
  const highlightedCity = useStore((s) => s.highlightedCity)
  const setHighlightedCity = useStore((s) => s.setHighlightedCity)
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const needs = useMemo(
    () => (profile ? getNumerologyNeeds(profile) : null),
    [profile],
  )

  const ranked = useMemo(
    () => (profile && cities.length > 0 ? rankCitiesByNumerology(cities, profile) : []),
    [cities, profile],
  )

  const maxEnergy = useMemo(
    () => cities.reduce((max, c) => Math.max(max, c.energyScore), 0) || 1,
    [cities],
  )

  // Scroll highlighted card into view when globe marker is hovered
  useEffect(() => {
    if (!highlightedCity || !scrollRef.current) return
    const card = cardRefs.current.get(highlightedCity)
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [highlightedCity])

  if (!profile || !needs || ranked.length === 0) return null

  const handleCityClick = (city: CityWithEnergy) => {
    setSelectedCity(city)
    setView('detail')
  }

  const cityKey = (city: CityWithEnergy) => `${city.name}|${city.country}`

  return (
    <>
      {/* ── Star button: always rendered, sits below settings gear, behind the panel ── */}
      <button
        className="absolute top-[4.25rem] left-4 z-[15] size-10 rounded-xl bg-white/90 backdrop-blur-md
                   border border-border/60 shadow-sm flex items-center justify-center
                   cursor-pointer hover:bg-white transition-colors"
        onClick={() => setExpanded(true)}
        aria-label="Show recommendations"
      >
        <svg className="size-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>

      {/* ── Expanded panel: slides over the pill ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="panel"
            className="absolute top-0 left-0 bottom-0 z-20 w-[360px] flex flex-col
                       bg-white/92 backdrop-blur-xl rounded-r-2xl border-r border-border/60 shadow-lg"
            initial={{ x: -360 }}
            animate={{ x: 0 }}
            exit={{ x: -360 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Top padding to clear settings gear */}
            <div className="pt-16 flex flex-col h-full min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
                <div>
                  <h2 className="font-serif text-sm font-semibold text-text tracking-tight">
                    Recommended for You
                  </h2>
                  <p className="text-[10px] text-muted mt-1">
                    Highest energy first, regionally diversified.
                  </p>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="size-7 rounded-lg flex items-center justify-center text-muted
                             hover:bg-surface transition-colors cursor-pointer"
                  aria-label="Collapse panel"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>

              {/* Scrollable content */}
              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-2.5"
                style={{ scrollbarWidth: 'thin' }}
              >
                {/* Numerology insight card */}
                <div className="rounded-xl bg-accent/5 border border-accent/15 p-3.5">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                      Year {profile.personalYear}
                    </span>
                    <span className="text-xs font-medium text-text">
                      {profile.lifeStage}
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    {needs.description}
                  </p>
                </div>

                {/* City cards */}
                {ranked.map(({ city, reason, matchingInfluences, isTopEnergyPick }) => {
                  const key = cityKey(city)
                  const isHighlighted = highlightedCity === key
                  const relativeEnergy = city.energyScore / maxEnergy
                  const energyPercent = Math.round(relativeEnergy * 100)

                  return (
                    <button
                      key={key}
                      ref={(el) => {
                        if (el) cardRefs.current.set(key, el)
                        else cardRefs.current.delete(key)
                      }}
                      className={`w-full text-left rounded-xl border bg-white p-3.5
                                  transition-all duration-150 cursor-pointer group
                                  ${isHighlighted
                                    ? 'border-l-2 border-l-accent border-t-border/60 border-r-border/60 border-b-border/60 bg-accent/5'
                                    : 'border-border/60 hover:bg-surface/80'
                                  }`}
                      onClick={() => handleCityClick(city)}
                      onMouseEnter={() => setHighlightedCity(key)}
                      onMouseLeave={() => setHighlightedCity(null)}
                    >
                      {/* City name + country */}
                      <div className="flex items-baseline justify-between mb-2">
                        <div>
                          <span className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                            {city.name}
                          </span>
                          <span className="text-xs text-muted ml-1.5">{city.country}</span>
                          {isTopEnergyPick && (
                            <span className="ml-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                              Top energy
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Energy bar */}
                      <div className="mb-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-muted">Energy</span>
                          <span className="text-[10px] font-semibold text-text">{energyPercent}%</span>
                        </div>
                        <div className="h-1 bg-surface rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent/70"
                            style={{ width: `${energyPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Influence pills */}
                      {matchingInfluences.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {matchingInfluences.slice(0, 2).map((inf) => (
                            <span
                              key={`${inf.planet}-${inf.lineType}`}
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${PLANET_COLORS[inf.planet]}12`,
                                color: PLANET_COLORS[inf.planet],
                              }}
                            >
                              <span
                                className="size-1.5 rounded-full inline-block flex-shrink-0"
                                style={{ backgroundColor: PLANET_COLORS[inf.planet] }}
                              />
                              {inf.label}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Reason */}
                      <p className="text-[11px] text-muted leading-relaxed">
                        {reason}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
