import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import { calcSoulProfile } from '../lib/numerology.ts'
import { computeAstroLines } from '../lib/astrocartography.ts'
import { loadCities } from '../data/loadCities.ts'
import { enrichCitiesWithEnergy } from '../lib/geo.ts'
import type { BirthData } from '../types/index.ts'

interface GeoResult {
  place_name: string
  center: [number, number]
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

export default function SettingsPanel() {
  const birthData = useStore((s) => s.birthData)
  const { setBirthData, setProfile, setAstroLines, setCities, setSelectedCity, setView } = useStore()

  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(birthData?.date ?? '')
  const [time, setTime] = useState(birthData?.time ?? '12:00')
  const [cityQuery, setCityQuery] = useState(birthData?.city ?? '')
  const [cityResults, setCityResults] = useState<GeoResult[]>([])
  const [selectedGeo, setSelectedGeo] = useState<GeoResult | null>(
    birthData ? { place_name: birthData.city, center: [birthData.lng, birthData.lat] } : null,
  )
  const [showResults, setShowResults] = useState(false)
  const [saving, setSaving] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Reset form when opening
  useEffect(() => {
    if (open && birthData) {
      setDate(birthData.date)
      setTime(birthData.time)
      setCityQuery(birthData.city)
      setSelectedGeo({ place_name: birthData.city, center: [birthData.lng, birthData.lat] })
      setShowResults(false)
    }
  }, [open, birthData])

  const searchCity = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCityResults([])
      return
    }
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=place&limit=5&access_token=${MAPBOX_TOKEN}`,
      )
      const data = await res.json()
      setCityResults(data.features ?? [])
    } catch {
      setCityResults([])
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
    setOpen(false)
  }

  const isValid = date && selectedGeo

  return (
    <div ref={panelRef} className="absolute top-4 left-4 z-30">
      <motion.button
        onClick={() => setOpen((o) => !o)}
        className="size-10 rounded-xl bg-white/90 backdrop-blur-md border border-border/60
                   shadow-sm flex items-center justify-center cursor-pointer
                   hover:bg-white transition-colors"
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
            className="absolute top-12 left-0 w-80 bg-white/95 backdrop-blur-md
                       rounded-2xl border border-border/60 shadow-lg overflow-visible"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-text">Edit birth data</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm
                               focus:outline-none focus:border-text/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm
                               focus:outline-none focus:border-text/30 transition-colors"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-muted mb-1.5">City</label>
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => {
                    setCityQuery(e.target.value)
                    setSelectedGeo(null)
                    setShowResults(true)
                  }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Search city..."
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm
                             placeholder:text-muted/50
                             focus:outline-none focus:border-text/30 transition-colors"
                />
                {showResults && cityResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border
                                  rounded-lg overflow-hidden z-50 shadow-lg">
                    {cityResults.map((result, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedGeo(result)
                          setCityQuery(result.place_name)
                          setShowResults(false)
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm text-text hover:bg-surface
                                   transition-colors border-b border-border/50 last:border-b-0 cursor-pointer"
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
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer
                            ${isValid && !saving
                              ? 'bg-accent text-white hover:bg-accent/90'
                              : 'bg-surface text-muted/50 cursor-not-allowed'}`}
              >
                {saving ? 'Recalculating...' : 'Update'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
