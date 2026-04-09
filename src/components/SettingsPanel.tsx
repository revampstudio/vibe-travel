import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import { calcSoulProfile } from '../lib/numerology.ts'
import { computeAstroLines } from '../lib/astrocartography.ts'
import { PLANET_COLORS, PLANETS } from '../lib/astrocartography.ts'
import { ENERGY_TIERS, LINE_TYPE_STYLES } from '../lib/mapGuidance.ts'
import {
  preloadBirthCityAutocomplete,
  searchBirthCities,
  type GeoResult,
} from '../lib/birthCityAutocomplete.ts'
import { loadCities } from '../data/loadCities.ts'
import { enrichCitiesWithEnergy } from '../lib/geo.ts'
import type { BirthData } from '../types/index.ts'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

export default function SettingsPanel() {
  const birthData = useStore((s) => s.birthData)
  const enabledPlanets = useStore((s) => s.enabledPlanets)
  const activeUtilityPanel = useStore((s) => s.activeUtilityPanel)
  const setActiveUtilityPanel = useStore((s) => s.setActiveUtilityPanel)
  const { setBirthData, setProfile, setAstroLines, setCities, setSelectedCity, setView } = useStore()

  const [showHow, setShowHow] = useState(false)
  const [date, setDate] = useState(birthData?.date ?? '')
  const [time, setTime] = useState(birthData?.time ?? '12:00')
  const [cityQuery, setCityQuery] = useState(birthData?.city ?? '')
  const [cityResults, setCityResults] = useState<GeoResult[]>([])
  const [selectedGeo, setSelectedGeo] = useState<GeoResult | null>(
    birthData ? { place_name: birthData.city, center: [birthData.lng, birthData.lat] } : null,
  )
  const [showResults, setShowResults] = useState(false)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const searchRequestIdRef = useRef(0)
  const open = activeUtilityPanel === 'settings'

  useEffect(() => {
    preloadBirthCityAutocomplete()
  }, [])

  const syncFormWithBirthData = useCallback((source: BirthData | null) => {
    if (!source) return
    setDate(source.date)
    setTime(source.time)
    setCityQuery(source.city)
    setSelectedGeo({ place_name: source.city, center: [source.lng, source.lat] })
    setShowResults(false)
  }, [])

  const searchCity = useCallback(async (query: string) => {
    const requestId = ++searchRequestIdRef.current

    if (query.length < 2) {
      setCityResults([])
      return
    }

    const results = await searchBirthCities(query, {
      limit: 5,
      includeMapbox: true,
      mapboxToken: MAPBOX_TOKEN,
    })

    if (requestId === searchRequestIdRef.current) {
      setCityResults(results)
    }
  }, [])

  useEffect(() => {
    if (!showResults) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCity(cityQuery), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [cityQuery, searchCity, showResults])

  const visiblePlanets = useMemo(
    () => PLANETS.filter((planet) => enabledPlanets.has(planet)),
    [enabledPlanets],
  )

  const handleSave = async () => {
    if (!date || !selectedGeo) return
    setSaving(true)

    const newBirth: BirthData = {
      date,
      time,
      city: selectedGeo.place_name,
      lng: selectedGeo.center[0],
      lat: selectedGeo.center[1],
    }

    const profile = calcSoulProfile(date)
    const astroLines = computeAstroLines(date, time)
    const cities = await loadCities()
    const enrichedCities = enrichCitiesWithEnergy(cities, astroLines)

    setBirthData(newBirth)
    setProfile(profile)
    setAstroLines(astroLines)
    setCities(enrichedCities)
    setSelectedCity(null)
    setView('globe')

    setSaving(false)
    setActiveUtilityPanel(null)
  }

  const isValid = date && selectedGeo

  return (
    <div className={`absolute left-4 top-4 ${open ? 'z-[35]' : 'z-10'}`}>
      <motion.button
        onClick={() => {
          const nextOpen = !open
          if (nextOpen) {
            syncFormWithBirthData(birthData)
            setShowHow(false)
          }
          setActiveUtilityPanel(nextOpen ? 'settings' : null)
        }}
        className="floating-control flex size-11 items-center justify-center cursor-pointer transition-colors hover:border-border-strong hover:bg-white"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Settings"
      >
        <svg
          className="size-5 text-text/70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="floating-panel fixed bottom-4 left-4 top-[4.25rem] z-[34] flex w-[min(25rem,calc(100vw-2rem))] flex-col rounded-[2rem]"
            initial={{ x: -420 }}
            animate={{ x: 0 }}
            exit={{ x: -420 }}
            transition={{ type: 'spring', damping: 33, stiffness: 290 }}
          >
            <div className="flex h-full min-h-0 flex-col px-5 pb-5 pt-5 md:px-6 md:pb-6 md:pt-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Settings</p>
                  <h3 className="mt-1 font-serif text-[1.5rem] leading-tight text-text">Update your details</h3>
                  <p className="mt-1.5 max-w-[18rem] text-sm leading-relaxed text-muted">
                    Refresh your map recommendations and keep your birth data accurate.
                  </p>
                </div>

                <button
                  onClick={() => setActiveUtilityPanel(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-white text-muted transition hover:border-border-strong hover:bg-surface-soft hover:text-text"
                  aria-label="Close settings panel"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text transition-colors focus:border-border-strong focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text transition-colors focus:border-border-strong focus:outline-none"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted">City</label>
                <input
                  type="text"
                  name="profile-city-search"
                  value={cityQuery}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-autocomplete="list"
                  onChange={(e) => {
                    setCityQuery(e.target.value)
                    setSelectedGeo(null)
                    setShowResults(true)
                  }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Search city..."
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-muted/60 transition-colors focus:border-border-strong focus:outline-none"
                />
                {showResults && cityResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-white shadow-[0_18px_30px_-20px_rgba(17,24,39,0.4)]">
                    {cityResults.map((result, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedGeo(result)
                          setCityQuery(result.place_name)
                          setShowResults(false)
                        }}
                        className="w-full cursor-pointer border-b border-border/50 px-3.5 py-2.5 text-left text-sm text-text transition-colors last:border-b-0 hover:bg-surface"
                      >
                        {result.place_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSave}
                disabled={!isValid || saving}
                className={`w-full rounded-xl py-3 text-sm font-semibold transition-all cursor-pointer
                            ${isValid && !saving
                              ? 'bg-accent text-white shadow-[0_10px_18px_-14px_rgba(227,28,75,0.75)] hover:bg-accent-strong'
                              : 'bg-surface text-muted/50 cursor-not-allowed'}`}
              >
                {saving ? 'Recalculating...' : 'Update'}
              </button>

              {/* How it works */}
              <div className="border-t border-border/70 pt-3.5">
                <button
                  onClick={() => setShowHow((v) => !v)}
                  className="flex w-full cursor-pointer items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
                >
                  <svg
                    className={`size-3.5 transition-transform duration-200 ${showHow ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium">How recommendations are calculated</span>
                </button>
                <AnimatePresence>
                  {showHow && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2.5 pt-2.5 text-sm leading-relaxed text-muted">
                        <div>
                          <span className="font-semibold text-text">Astro lines</span> &mdash; Your
                          birth date and time determine where each planet's Midheaven, IC, Ascendant,
                          and Descendant lines fall on the globe. These are the colored curves on the map.
                        </div>
                        <div>
                          <span className="font-semibold text-text">Energy score</span> &mdash; Cities
                          near more of your astro lines receive a higher energy score, shown as the red
                          markers and the energy bar on each card.
                        </div>
                        <div>
                          <span className="font-semibold text-text">Personal year</span> &mdash; Your
                          birth date produces a numerology life path and personal year number (1&ndash;9,
                          or master numbers 11/22/33). Each year number has a theme and a set of
                          planet&ndash;line combinations that support it.
                        </div>
                        <div>
                          <span className="font-semibold text-text">Recommendations</span> &mdash; Cities
                          are ranked by a blend of 60% numerology relevance (how well a city's active
                          lines match your personal year's needs) and 40% raw energy alignment. The top 8
                          become your picks.
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <section className="space-y-3 border-t border-border/70 pt-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Map guide</p>
                  <p className="mt-1 text-sm text-muted">Colors and line styles used on the globe.</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Dot color = energy</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {ENERGY_TIERS.map((tier) => (
                      <div key={tier.id} className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full border border-white/80"
                          style={{ backgroundColor: tier.color }}
                        />
                        <span className="text-xs text-text">
                          {tier.label} <span className="text-muted">{tier.rangeLabel}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Line color = planet</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {visiblePlanets.map((planet) => (
                      <div key={planet} className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full border border-white/80"
                          style={{ backgroundColor: PLANET_COLORS[planet] }}
                        />
                        <span className="text-xs text-text">{planet}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Line style = angle</p>
                  <div className="space-y-2">
                    {LINE_TYPE_STYLES.map((style) => (
                      <div key={style.lineType} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text">
                            {style.lineType} · {style.label}
                          </p>
                          <p className="text-[11px] text-muted">{style.context}</p>
                        </div>
                        <svg className="shrink-0" width="52" height="8" viewBox="0 0 52 8" aria-hidden="true">
                          <line
                            x1="0"
                            y1="4"
                            x2="52"
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
              </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
