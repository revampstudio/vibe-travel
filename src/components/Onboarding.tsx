import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import { calcSoulProfile } from '../lib/numerology.ts'
import { computeAstroLines } from '../lib/astrocartography.ts'
import {
  preloadBirthCityAutocomplete,
  searchBirthCities,
  type GeoResult,
} from '../lib/birthCityAutocomplete.ts'
import { loadCities } from '../data/loadCities.ts'
import { enrichCitiesWithEnergy } from '../lib/geo.ts'
import type { BirthData } from '../types/index.ts'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

const STEP_COPY = {
  1: {
    title: 'How Vibe Travel works',
    description: 'A quick overview before we build your personal map.',
  },
  2: {
    title: 'Start with your birthday',
    description: 'We use your birth date to calculate your numerology profile and map timing.',
  },
  3: {
    title: 'Add birth details',
    description: 'Birth time and city let us place your planetary lines accurately on the globe.',
  },
} as const

const HOW_IT_WORKS = [
  'We use your birthday to calculate your numerology profile.',
  'We map planetary lines from your birth time and location.',
  'We rank cities by alignment so you can explore your best matches.',
]

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeBirthday(day: string, month: string, year: string): string | null {
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)

  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null
  if (y < 1900 || m < 1 || m > 12) return null

  const maxDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  if (d < 1 || d > maxDay) return null

  const birthDate = new Date(Date.UTC(y, m - 1, d))
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  if (birthDate > todayUtc) return null

  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getBirthdayError(day: string, month: string, year: string): string | null {
  if (!day || !month || !year) return 'Enter your full birthday (day, month, and year).'
  if (day.length > 2 || month.length > 2 || year.length !== 4) {
    return 'Use DD, MM, and YYYY format.'
  }

  const isoDate = normalizeBirthday(day, month, year)
  if (!isoDate) return 'Enter a valid date in the past.'

  return null
}

export default function Onboarding() {
  const { setBirthData, setProfile, setAstroLines, setCities, setView } = useStore()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [timeKnown, setTimeKnown] = useState(true)
  const [time, setTime] = useState('12:00')
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<GeoResult[]>([])
  const [selectedGeo, setSelectedGeo] = useState<GeoResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showBirthdayErrors, setShowBirthdayErrors] = useState(false)
  const [showSubmitErrors, setShowSubmitErrors] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestIdRef = useRef(0)

  useEffect(() => {
    preloadBirthCityAutocomplete()
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
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCity(cityQuery), 280)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [cityQuery, searchCity])

  const birthdayError = useMemo(
    () => getBirthdayError(birthDay, birthMonth, birthYear),
    [birthDay, birthMonth, birthYear],
  )

  const birthdayIso = useMemo(
    () => normalizeBirthday(birthDay, birthMonth, birthYear),
    [birthDay, birthMonth, birthYear],
  )

  const isCityValid = Boolean(selectedGeo)
  const isTimeValid = !timeKnown || Boolean(time)
  const canSubmit = Boolean(birthdayIso && isCityValid && isTimeValid && !isSubmitting)

  const handleCitySelect = (result: GeoResult) => {
    setSelectedGeo(result)
    setCityQuery(result.place_name)
    setShowResults(false)
  }

  const handleStartSetup = () => {
    setStep(2)
  }

  const handleContinueBirthday = () => {
    setShowBirthdayErrors(true)
    if (birthdayError) return
    setStep(3)
  }

  const handleSubmit = async () => {
    setShowSubmitErrors(true)
    if (!canSubmit || !selectedGeo || !birthdayIso) return

    setIsSubmitting(true)

    await new Promise<void>((resolve) => setTimeout(resolve, 320))

    const birthData: BirthData = {
      date: birthdayIso,
      time: timeKnown ? time : '12:00',
      city: selectedGeo.place_name,
      lng: selectedGeo.center[0],
      lat: selectedGeo.center[1],
    }

    const profile = calcSoulProfile(birthData.date)
    const astroLines = computeAstroLines(birthData.date, birthData.time)
    const cities = await loadCities()
    const enrichedCities = enrichCitiesWithEnergy(cities, astroLines)

    setBirthData(birthData)
    setProfile(profile)
    setAstroLines(astroLines)
    setCities(enrichedCities)
    setView('globe')
  }

  const cityError = showSubmitErrors && !isCityValid ? 'Choose your birth city from the suggestions.' : null
  const timeError = showSubmitErrors && !isTimeValid ? 'Enter your birth time, or choose “I do not know”.' : null

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg px-4 py-4 md:items-center md:px-6 md:py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="w-full max-w-[48rem] rounded-[2rem] border border-border/70 bg-white p-6 shadow-[0_36px_95px_-52px_rgba(15,23,42,0.42)] md:p-9"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-border/70 pb-6">
          <div className="flex items-center gap-3">
            <img src="/logo-512.png" alt="" className="size-10 rounded-xl border border-border/70" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted">Vibe Travel</p>
              <p className="text-sm font-medium text-text">Personal map setup</p>
            </div>
          </div>
          <p className="rounded-full border border-border/80 bg-surface-soft px-3 py-1.5 text-sm font-semibold tabular-nums text-muted">Step {step} of 3</p>
        </div>

        <div className="mb-6 flex gap-2" aria-hidden="true">
          {[1, 2, 3].map((value) => (
            <span
              key={value}
              className={`h-1.5 flex-1 rounded-full ${step >= value ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
          >
            <h1 className="mb-2 font-serif text-[2.2rem] leading-tight text-text md:text-[2.85rem]">{STEP_COPY[step].title}</h1>
            <p className="mb-7 max-w-[42rem] text-base leading-7 text-muted text-pretty">{STEP_COPY[step].description}</p>

            {step === 1 ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-border/80 bg-surface-soft px-5 py-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">How it works</p>
                  <ul className="space-y-1.5">
                    {HOW_IT_WORKS.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-text/90">
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-accent/80" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-sm text-muted">Setup takes less than a minute.</p>

                <button
                  type="button"
                  onClick={handleStartSetup}
                  className="w-full rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-white shadow-[0_16px_30px_-24px_rgba(227,28,75,0.85)] transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  Start setup
                </button>
              </div>
            ) : step === 2 ? (
              <div className="space-y-6">
                <fieldset>
                  <legend className="mb-2.5 block text-sm font-medium text-text">Birthday</legend>
                  <div className="grid grid-cols-3 gap-3" role="group" aria-label="Birthday fields">
                    <input
                      aria-label="Birth day"
                      inputMode="numeric"
                      autoComplete="bday-day"
                      placeholder="DD"
                      maxLength={2}
                      value={birthDay}
                      onChange={(event) => setBirthDay(digitsOnly(event.target.value))}
                      aria-invalid={showBirthdayErrors && Boolean(birthdayError)}
                      className="w-full rounded-xl border border-border bg-white px-3 py-3 text-center text-base text-text placeholder:text-muted/55 focus:border-border-strong focus:outline-none"
                    />
                    <input
                      aria-label="Birth month"
                      inputMode="numeric"
                      autoComplete="bday-month"
                      placeholder="MM"
                      maxLength={2}
                      value={birthMonth}
                      onChange={(event) => setBirthMonth(digitsOnly(event.target.value))}
                      aria-invalid={showBirthdayErrors && Boolean(birthdayError)}
                      className="w-full rounded-xl border border-border bg-white px-3 py-3 text-center text-base text-text placeholder:text-muted/55 focus:border-border-strong focus:outline-none"
                    />
                    <input
                      aria-label="Birth year"
                      inputMode="numeric"
                      autoComplete="bday-year"
                      placeholder="YYYY"
                      maxLength={4}
                      value={birthYear}
                      onChange={(event) => setBirthYear(digitsOnly(event.target.value))}
                      aria-invalid={showBirthdayErrors && Boolean(birthdayError)}
                      className="w-full rounded-xl border border-border bg-white px-3 py-3 text-center text-base text-text placeholder:text-muted/55 focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted">Example: 27 03 1992</p>
                  {showBirthdayErrors && birthdayError && (
                    <p className="mt-2 text-sm font-medium text-accent">{birthdayError}</p>
                  )}
                </fieldset>

                <div className="rounded-2xl border border-border/80 bg-surface-soft px-4 py-3.5 text-sm text-muted">
                  You can update these details anytime from Settings.
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-xl border border-border px-5 py-3.5 text-sm font-medium text-text transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:w-[140px]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleContinueBirthday}
                    className="flex-1 rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-white shadow-[0_16px_30px_-24px_rgba(227,28,75,0.85)] transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label htmlFor="birth-time" className="mb-2.5 block text-sm font-medium text-text">
                    Birth time
                  </label>
                  <input
                    id="birth-time"
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    disabled={!timeKnown}
                    className={`w-full rounded-xl border bg-white px-4 py-3.5 text-base text-text transition-colors focus:border-border-strong focus:outline-none ${
                      !timeKnown
                        ? 'cursor-not-allowed border-border/70 text-muted/60'
                        : 'border-border'
                    }`}
                  />
                  <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={!timeKnown}
                      onChange={(event) => setTimeKnown(!event.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
                    />
                    I do not know my birth time (use 12:00 PM)
                  </label>
                  {timeError && <p className="mt-2 text-sm font-medium text-accent">{timeError}</p>}
                </div>

                <div className="relative">
                  <label htmlFor="birth-city" className="mb-2.5 block text-sm font-medium text-text">
                    Birth city
                  </label>
                   <input
                     id="birth-city"
                     type="text"
                     name="birth-city-search"
                     value={cityQuery}
                     autoComplete="off"
                     autoCorrect="off"
                     autoCapitalize="none"
                     spellCheck={false}
                     aria-autocomplete="list"
                     onChange={(event) => {
                       setCityQuery(event.target.value)
                       setSelectedGeo(null)
                      setShowResults(true)
                    }}
                   onFocus={() => setShowResults(true)}
                   placeholder="Search for your birth city"
                    className="w-full rounded-xl border border-border bg-white px-4 py-3.5 text-base text-text placeholder:text-muted/55 transition-colors focus:border-border-strong focus:outline-none"
                  />

                  {showResults && cityResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-white shadow-[0_18px_32px_-20px_rgba(17,24,39,0.4)]">
                      {cityResults.map((result, index) => (
                        <button
                          key={`${result.place_name}-${index}`}
                          type="button"
                          onClick={() => handleCitySelect(result)}
                          className="flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left text-sm text-text transition-colors last:border-b-0 hover:bg-surface-soft"
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-accent/70" aria-hidden="true" />
                          {result.place_name}
                        </button>
                      ))}
                    </div>
                  )}

                  {cityError && <p className="mt-2 text-sm font-medium text-accent">{cityError}</p>}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-xl border border-border px-5 py-3.5 text-sm font-medium text-text transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:w-[140px]"
                  >
                    Back
                  </button>
                  <motion.button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`flex-1 rounded-xl py-3.5 text-base font-semibold transition-colors ${
                      canSubmit
                        ? 'bg-accent text-white shadow-[0_16px_30px_-24px_rgba(227,28,75,0.85)] hover:bg-accent-strong'
                        : 'cursor-not-allowed border border-border bg-surface-soft text-muted/55'
                    }`}
                    whileTap={canSubmit ? { scale: 0.99 } : {}}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2.5">
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="3"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Building your map...
                      </span>
                    ) : (
                      'Generate my map'
                    )}
                  </motion.button>
                </div>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
