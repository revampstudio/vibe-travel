import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
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

export default function Onboarding() {
  const { setBirthData, setProfile, setAstroLines, setCities, setView } = useStore()

  const [date, setDate] = useState('')
  const [time, setTime] = useState('12:00')
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<GeoResult[]>([])
  const [selectedGeo, setSelectedGeo] = useState<GeoResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => { loadCities() }, [])

  const searchCity = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCityResults([])
      return
    }

    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'your_mapbox_token_here') {
      const fallback: GeoResult[] = [
        { place_name: 'New York, USA', center: [-74.006, 40.7128] },
        { place_name: 'London, United Kingdom', center: [-0.1276, 51.5074] },
        { place_name: 'Tokyo, Japan', center: [139.6917, 35.6895] },
        { place_name: 'Sydney, Australia', center: [151.2093, -33.8688] },
        { place_name: 'Paris, France', center: [2.3522, 48.8566] },
        { place_name: 'Los Angeles, USA', center: [-118.2437, 34.0522] },
        { place_name: 'Berlin, Germany', center: [13.4050, 52.5200] },
        { place_name: 'Mumbai, India', center: [72.8777, 19.0760] },
        { place_name: 'São Paulo, Brazil', center: [-46.6333, -23.5505] },
        { place_name: 'Cairo, Egypt', center: [31.2357, 30.0444] },
      ]
      setCityResults(fallback.filter(r => r.place_name.toLowerCase().includes(query.toLowerCase())))
      return
    }

    try {
      const encodedQuery = encodeURIComponent(query)
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?types=place&limit=5&access_token=${MAPBOX_TOKEN}`,
      )
      const data = await res.json()
      setCityResults(data.features ?? [])
    } catch {
      setCityResults([])
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCity(cityQuery), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [cityQuery, searchCity])

  const handleCitySelect = (result: GeoResult) => {
    setSelectedGeo(result)
    setCityQuery(result.place_name)
    setShowResults(false)
  }

  const handleSubmit = async () => {
    if (!date || !selectedGeo) return
    setIsSubmitting(true)

    await new Promise<void>(r => setTimeout(r, 400))

    const birthData: BirthData = {
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

    setBirthData(birthData)
    setProfile(profile)
    setAstroLines(astroLines)
    setCities(enrichedCities)
    setView('globe')
  }

  const isValid = date && selectedGeo

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className="relative z-10 w-full max-w-xl px-8"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        {/* Header */}
        <div className="text-center mb-16">
          <motion.img
            src="/logo-512.png"
            alt=""
            className="size-16 mx-auto mb-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          />
          <motion.h1
            className="font-serif text-5xl md:text-6xl font-semibold tracking-tight text-text text-balance mb-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            Soul Cartography
          </motion.h1>
          <motion.p
            className="text-muted text-xl leading-relaxed text-pretty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.45 }}
          >
            Discover where the stars align for you
          </motion.p>
        </div>

        {/* Form */}
        <motion.div
          className="space-y-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
        >
          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-text mb-3">
                Birth date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-4 py-4 text-text text-base
                           focus:outline-none focus:border-text focus:ring-1 focus:ring-text/10
                           transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-3">
                Birth time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-4 py-4 text-text text-base
                           focus:outline-none focus:border-text focus:ring-1 focus:ring-text/10
                           transition-colors"
              />
            </div>
          </div>

          {/* Birth City */}
          <div className="relative">
            <label className="block text-sm font-medium text-text mb-3">
              Birth city
            </label>
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => {
                setCityQuery(e.target.value)
                setSelectedGeo(null)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
              placeholder="Search for your birth city..."
              className="w-full bg-bg border border-border rounded-xl px-4 py-4 text-text text-base
                         placeholder:text-muted/50
                         focus:outline-none focus:border-text focus:ring-1 focus:ring-text/10
                         transition-colors"
            />
            {showResults && cityResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-bg border border-border
                              rounded-xl overflow-hidden z-20 shadow-lg">
                {cityResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => handleCitySelect(result)}
                    className="w-full text-left px-5 py-3.5 text-sm text-text hover:bg-surface
                               transition-colors border-b border-border/50 last:border-b-0
                               flex items-center gap-3 cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {result.place_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <motion.button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className={`w-full py-4 rounded-xl font-semibold text-base
                          transition-all duration-200 cursor-pointer
                          ${isValid && !isSubmitting
                            ? 'bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/25 active:scale-[0.99]'
                            : 'bg-surface text-muted/50 cursor-not-allowed border border-border'}`}
              whileHover={isValid && !isSubmitting ? { scale: 1.005 } : {}}
              whileTap={isValid && !isSubmitting ? { scale: 0.995 } : {}}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Mapping your stars...
                </span>
              ) : (
                'Reveal your map'
              )}
            </motion.button>
          </div>

          <p className="text-center text-sm text-muted text-pretty">
            Your birth data is used only for astronomical calculations and never stored.
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
