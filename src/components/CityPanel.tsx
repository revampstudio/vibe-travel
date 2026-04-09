import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import { getInterpretation } from '../lib/interpretations.ts'
import { fetchTravelAdvisory, type TravelAdvisoryLookup } from '../lib/travelAdvisory.ts'
import { fetchCityWikiSummary } from '../lib/wiki.ts'
import type { Planet, LineType } from '../types/index.ts'

const FALLBACK_CITY_IMAGES = [
  'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1400&q=70',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1400&q=70',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=70',
  'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=1400&q=70',
  'https://images.unsplash.com/photo-1521292270410-a8c4d716d518?auto=format&fit=crop&w=1400&q=70',
  'https://images.unsplash.com/photo-1483683804023-6ccdb62f86ef?auto=format&fit=crop&w=1400&q=70',
]

function deterministicImageForCity(cityName: string, country: string): string {
  const seed = `${cityName}|${country}`
  const hash = seed.split('').reduce((acc, char, index) => acc + (char.charCodeAt(0) * (index + 11)), 0)
  return FALLBACK_CITY_IMAGES[hash % FALLBACK_CITY_IMAGES.length]
}

function useWikiSummary(cityName: string, country: string, latitude?: number, longitude?: number) {
  const [summariesByLocation, setSummariesByLocation] = useState<Record<string, string | null>>({})
  const cacheKey = `${cityName.trim().toLowerCase()}|${country.trim().toLowerCase()}`

  useEffect(() => {
    if (!cityName || !country) return
    if (Object.prototype.hasOwnProperty.call(summariesByLocation, cacheKey)) return

    const controller = new AbortController()

    fetchCityWikiSummary(cityName, country, latitude, longitude, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setSummariesByLocation((current) => {
          if (Object.prototype.hasOwnProperty.call(current, cacheKey)) return current
          return { ...current, [cacheKey]: result?.summary ?? null }
        })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setSummariesByLocation((current) => {
          if (Object.prototype.hasOwnProperty.call(current, cacheKey)) return current
          return { ...current, [cacheKey]: null }
        })
      })

    return () => controller.abort()
  }, [cacheKey, cityName, country, latitude, longitude, summariesByLocation])

  const summary = Object.prototype.hasOwnProperty.call(summariesByLocation, cacheKey)
    ? summariesByLocation[cacheKey]
    : null
  const loading = Boolean(cityName && country) && !Object.prototype.hasOwnProperty.call(summariesByLocation, cacheKey)

  return { summary, loading }
}

const PLANET_COLORS: Record<Planet, string> = {
  Sun: '#F9A825', Moon: '#78909C', Mercury: '#00ACC1', Venus: '#E84393',
  Mars: '#E53935', Jupiter: '#6C5CE7', Saturn: '#A67C52',
  Uranus: '#42A5F5', Neptune: '#7E57C2', Pluto: '#455A64',
}

const LINE_LABELS: Record<LineType, string> = {
  MC: 'Midheaven', IC: 'Imum Coeli', ASC: 'Ascendant', DSC: 'Descendant',
}

const ADVISORY_STYLES: Record<1 | 2 | 3 | 4, { panel: string, badge: string }> = {
  1: {
    panel: 'border-emerald-200 bg-emerald-50/80',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  2: {
    panel: 'border-amber-200 bg-amber-50/80',
    badge: 'bg-amber-100 text-amber-800',
  },
  3: {
    panel: 'border-orange-200 bg-orange-50/80',
    badge: 'bg-orange-100 text-orange-800',
  },
  4: {
    panel: 'border-red-200 bg-red-50/80',
    badge: 'bg-red-100 text-red-800',
  },
}

const SUGGESTED_EXPERIENCES = [
  {
    title: 'Architectural Morning Walk',
    desc: 'Join a local design-led route through signature streets and neighborhoods.',
    tag: 'Culture',
  },
  {
    title: 'Sunrise Movement Session',
    desc: 'Ground your day with breathwork and light movement at a scenic outdoor spot.',
    tag: 'Wellness',
  },
  {
    title: 'Regional Tasting Evening',
    desc: 'Discover flavors that reflect the city’s identity with a chef-led tasting.',
    tag: 'Food',
  },
] as const

function useTravelAdvisory(country: string) {
  const [advisoriesByCountry, setAdvisoriesByCountry] = useState<Record<string, TravelAdvisoryLookup | null>>({})

  useEffect(() => {
    if (!country) return
    if (Object.prototype.hasOwnProperty.call(advisoriesByCountry, country)) return

    const controller = new AbortController()
    fetchTravelAdvisory(country, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setAdvisoriesByCountry((current) => {
          if (Object.prototype.hasOwnProperty.call(current, country)) return current
          return { ...current, [country]: result }
        })
      })

    return () => controller.abort()
  }, [country, advisoriesByCountry])

  const hasLoadedCountry = Object.prototype.hasOwnProperty.call(advisoriesByCountry, country)
  const advisoryState = hasLoadedCountry ? advisoriesByCountry[country] : null
  const advisory = advisoryState?.status === 'ok' ? advisoryState.advisory : null
  const loading = Boolean(country) && !hasLoadedCountry

  return { advisory, advisoryState, loading }
}

function formatAdvisoryDate(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Date unavailable'

  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))
}

function shortCountry(country: string): string {
  const parts = country.split(',')
  return parts[0]?.trim() ?? country
}

export default function CityPanel() {
  const selectedCity = useStore((s) => s.selectedCity)
  const setSelectedCity = useStore((s) => s.setSelectedCity)
  const setView = useStore((s) => s.setView)
  const cities = useStore((s) => s.cities)

  const cityName = selectedCity?.name ?? ''
  const countryName = selectedCity?.country ?? ''

  const { summary: wikiSummary, loading: wikiLoading } = useWikiSummary(
    cityName,
    countryName,
    selectedCity?.lat,
    selectedCity?.lng,
  )
  const { advisory, advisoryState, loading: advisoryLoading } = useTravelAdvisory(
    countryName,
  )

  const maxEnergy = useMemo(
    () => cities.reduce((max, city) => Math.max(max, city.energyScore), 0),
    [cities],
  )

  const energyPercent = useMemo(() => {
    if (!selectedCity || maxEnergy <= 0) return 0
    return Math.round((selectedCity.energyScore / maxEnergy) * 100)
  }, [selectedCity, maxEnergy])

  const uniqueLines = useMemo(() => {
    const seen = new Set<string>()
    return (selectedCity?.activeLines ?? []).filter((line) => {
      const key = `${line.planet}-${line.lineType}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [selectedCity?.activeLines])

  const heroImageCandidates = useMemo(() => {
    const primary = deterministicImageForCity(cityName || 'City', countryName || 'Country')
    return [primary, ...FALLBACK_CITY_IMAGES.filter((url) => url !== primary)]
  }, [cityName, countryName])

  const heroImageKey = `${cityName}|${countryName}`
  const [heroImageState, setHeroImageState] = useState<{ key: string, index: number }>({
    key: '',
    index: 0,
  })
  const heroImageIndex = heroImageState.key === heroImageKey ? heroImageState.index : 0

  const heroImage = heroImageCandidates[heroImageIndex] ?? null

  const handleHeroImageError = useCallback(() => {
    setHeroImageState((current) => {
      const currentIndex = current.key === heroImageKey ? current.index : 0
      if (currentIndex + 1 >= heroImageCandidates.length) {
        return { key: heroImageKey, index: currentIndex }
      }
      return { key: heroImageKey, index: currentIndex + 1 }
    })
  }, [heroImageCandidates.length, heroImageKey])

  const quickFacts = useMemo(
    () => [
      {
        label: 'Country',
        value: shortCountry(countryName || '—'),
      },
      {
        label: 'Energy score',
        value: selectedCity
          ? `${selectedCity.energyScore.toFixed(1)} / ${Math.max(maxEnergy, 0.1).toFixed(1)}`
          : '—',
      },
      {
        label: 'Active influences',
        value: `${uniqueLines.length}`,
      },
    ],
    [countryName, selectedCity, uniqueLines.length, maxEnergy],
  )

  const heroImageAlt = useMemo(
    () => `${cityName || 'City'} skyline`,
    [cityName],
  )

  if (!selectedCity) return null

  const handleClose = () => {
    setSelectedCity(null)
    setView('globe')
  }

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-[30] md:inset-y-0 md:left-auto md:w-full md:max-w-[34rem]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 280 }}
    >
      <div className="floating-panel flex h-[82vh] flex-col overflow-hidden md:h-full md:rounded-none md:rounded-l-[2rem]">
        <div className="relative border-b border-border/70 bg-surface">
          <div className="absolute inset-0">
            {heroImage && (
              <img
                src={heroImage}
                alt={heroImageAlt}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={handleHeroImageError}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/82 to-white/28" />
          </div>

          <div className="relative z-10 px-5 pb-6 pt-5 md:px-7 md:pb-7 md:pt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                onClick={handleClose}
                aria-label="Back to globe"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border/80 bg-white/92 px-3.5 py-2 text-sm font-medium text-text transition hover:border-border-strong hover:bg-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to map
              </button>
              <span className="rounded-full border border-accent/20 bg-accent-light px-3 py-1.5 text-xs font-semibold text-accent-strong">
                {uniqueLines.length} {uniqueLines.length === 1 ? 'influence' : 'influences'}
              </span>
            </div>

            <h2 className="font-serif text-[2.2rem] font-semibold leading-tight text-text md:text-[2.55rem]">
              {selectedCity.name}
            </h2>
            <p className="mt-1.5 text-base text-muted md:text-lg">{selectedCity.country}</p>

            <div className="mt-5 grid grid-cols-3 gap-2.5 md:gap-3">
              {quickFacts.map((fact) => (
                <div key={fact.label} className="rounded-xl border border-white/50 bg-white/82 px-3 py-2.5 backdrop-blur-sm">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{fact.label}</p>
                  <p className="mt-1 text-sm font-semibold text-text md:text-[15px]">{fact.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-border/80 bg-white/90 p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Alignment</span>
                <span className="text-sm font-semibold text-text">{energyPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-soft">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${energyPercent}%` }}
                  transition={{ duration: 0.75, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-6 md:px-7 md:pb-10 md:pt-7">
          <div className="space-y-6">
            {(advisoryLoading || advisoryState?.status === 'ok' || advisoryState?.status === 'unavailable') && (
              <section>
                <h3 className="mb-3 text-[1.05rem] font-semibold text-text">
                  Australian Government Travel Advisory
                </h3>

                {advisoryLoading ? (
                  <div className="space-y-2.5">
                    <div className="h-3.5 w-full animate-pulse rounded-full bg-surface-soft" />
                    <div className="h-3.5 w-5/6 animate-pulse rounded-full bg-surface-soft" />
                    <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-surface-soft" />
                  </div>
                ) : advisory ? (
                  <div className={`rounded-2xl border px-4 py-4 md:px-5 md:py-5 ${ADVISORY_STYLES[advisory.adviceLevel].panel}`}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-text">{advisory.matchedCountry}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ADVISORY_STYLES[advisory.adviceLevel].badge}`}>
                        Level {advisory.adviceLevel}
                      </span>
                    </div>

                    <p className="mb-2 text-[15px] font-semibold text-text">{advisory.adviceLabel}</p>
                    <p className="text-sm leading-relaxed text-muted">{advisory.summary}</p>

                    {advisory.regionalAdvisories.length > 0 && (
                      <div className="mt-3.5">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                          Regional notes
                        </p>
                        <ul className="list-disc space-y-1 pl-5">
                          {advisory.regionalAdvisories.slice(0, 3).map((note) => (
                            <li key={note} className="text-sm leading-relaxed text-muted">{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted">
                        Updated {formatAdvisoryDate(advisory.updatedAt)}
                        {advisory.freshness === 'stale' && ' (cached)'}
                      </p>
                      <a
                        href={advisory.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-accent transition hover:text-accent-strong"
                      >
                        Official source
                      </a>
                    </div>
                  </div>
                ) : advisoryState?.status === 'unavailable' ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 md:px-5 md:py-5">
                    <p className="mb-2 text-[15px] font-semibold text-text">Travel safety information is unavailable</p>
                    <p className="text-sm leading-relaxed text-muted">
                      The app could not reach the Australian Government advisory feed for this destination just now.
                    </p>
                  </div>
                ) : null}
              </section>
            )}

            <section>
              <h3 className="mb-3 text-[1.05rem] font-semibold text-text">A local vibe preview</h3>
              <p className="text-sm leading-relaxed text-muted">
                {wikiLoading
                  ? 'Loading city context...'
                  : (wikiSummary || `${selectedCity.name} offers a compelling blend of culture, pace, and atmosphere — ideal for an intentional stay aligned with your current cycle.`)}
              </p>
            </section>

            <section>
              <h3 className="mb-4 text-[1.05rem] font-semibold text-text">Planetary influences</h3>
              {uniqueLines.length > 0 ? (
                <div className="space-y-3.5">
                  {uniqueLines.map((line) => (
                    <article
                      key={`${line.planet}-${line.lineType}`}
                      className="rounded-2xl border border-border/90 bg-surface px-4 py-4 md:px-5"
                    >
                      <div className="mb-2.5 flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${PLANET_COLORS[line.planet]}18` }}
                        >
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: PLANET_COLORS[line.planet] }}
                          />
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold text-text">
                            {line.planet}{' '}
                            <span className="font-medium text-muted">on</span>{' '}
                            <span style={{ color: PLANET_COLORS[line.planet] }}>{LINE_LABELS[line.lineType]}</span>
                          </p>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-muted">
                        {getInterpretation(line.planet, line.lineType)}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-muted">
                  No strong planetary lines pass directly through this city, but nearby influences may still resonate with your chart.
                </p>
              )}
            </section>

            <section>
              <h3 className="mb-4 text-[1.05rem] font-semibold text-text">Suggested experiences</h3>
              <div className="space-y-3.5">
                {SUGGESTED_EXPERIENCES.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border/90 bg-surface px-4 py-4 md:px-5">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <p className="text-[15px] font-semibold text-text">{item.title}</p>
                      <span className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent-strong">{item.tag}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
