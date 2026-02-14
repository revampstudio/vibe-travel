import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import { getInterpretation } from '../lib/interpretations.ts'
import { fetchTravelAdvisory, type TravelAdvisory } from '../lib/travelAdvisory.ts'
import type { Planet, LineType } from '../types/index.ts'

const wikiCache = new Map<string, string>()

function useWikiSummary(cityName: string, country: string) {
  const [, setCacheVersion] = useState(0)

  useEffect(() => {
    if (!cityName) {
      return
    }

    if (wikiCache.has(cityName)) {
      return
    }

    const controller = new AbortController()
    const encoded = encodeURIComponent(cityName.replace(/ /g, '_'))

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const text = data.extract ?? ''
        wikiCache.set(cityName, text)
        if (!controller.signal.aborted) {
          setCacheVersion((value) => value + 1)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          wikiCache.set(cityName, '')
          setCacheVersion((value) => value + 1)
        }
      })

    return () => controller.abort()
  }, [cityName, country])

  const summary = wikiCache.get(cityName) ?? null
  const loading = Boolean(cityName) && !wikiCache.has(cityName)

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
    panel: 'border-emerald-200 bg-emerald-50/60',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  2: {
    panel: 'border-amber-200 bg-amber-50/70',
    badge: 'bg-amber-100 text-amber-800',
  },
  3: {
    panel: 'border-orange-200 bg-orange-50/70',
    badge: 'bg-orange-100 text-orange-800',
  },
  4: {
    panel: 'border-red-200 bg-red-50/70',
    badge: 'bg-red-100 text-red-800',
  },
}

function useTravelAdvisory(country: string) {
  const [advisoriesByCountry, setAdvisoriesByCountry] = useState<Record<string, TravelAdvisory | null>>({})

  useEffect(() => {
    if (!country) {
      return
    }

    if (Object.prototype.hasOwnProperty.call(advisoriesByCountry, country)) {
      return
    }

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
  const advisory = hasLoadedCountry ? advisoriesByCountry[country] : null
  const loading = Boolean(country) && !hasLoadedCountry

  return { advisory, loading }
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

export default function CityPanel() {
  const selectedCity = useStore((s) => s.selectedCity)
  const setSelectedCity = useStore((s) => s.setSelectedCity)
  const setView = useStore((s) => s.setView)
  const cities = useStore((s) => s.cities)

  const { summary: wikiSummary, loading: wikiLoading } = useWikiSummary(
    selectedCity?.name ?? '',
    selectedCity?.country ?? '',
  )
  const { advisory, loading: advisoryLoading } = useTravelAdvisory(
    selectedCity?.country ?? '',
  )

  if (!selectedCity) return null

  const maxEnergy = cities.reduce((max, c) => Math.max(max, c.energyScore), 0)
  const relativeScore = maxEnergy > 0 ? selectedCity.energyScore / maxEnergy : 0
  const energyPercent = Math.round(relativeScore * 100)

  const seen = new Set<string>()
  const uniqueLines = selectedCity.activeLines.filter((line) => {
    const key = `${line.planet}-${line.lineType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const handleClose = () => {
    setSelectedCity(null)
    setView('globe')
  }

  return (
    <motion.div
      className="absolute top-0 right-0 bottom-0 z-30 w-full max-w-md"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      <div className="h-full bg-white border-l border-border overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border z-10">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={handleClose}
              aria-label="Back to globe"
              className="flex items-center gap-2 text-text hover:text-muted transition-colors
                         cursor-pointer min-h-[44px]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>
            <span className="text-xs font-semibold text-accent bg-accent/10 px-3 py-1.5 rounded-full">
              {uniqueLines.length} {uniqueLines.length === 1 ? 'influence' : 'influences'}
            </span>
          </div>
        </div>

        {/* City name hero */}
        <div className="px-6 pt-6 pb-8 border-b border-border">
          <h2 className="font-serif text-4xl font-semibold text-text tracking-tight text-balance">
            {selectedCity.name}
          </h2>
          <p className="text-lg text-muted mt-2">{selectedCity.country}</p>

          {/* Energy score */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted">Energy Alignment</span>
              <span className="text-xs font-semibold text-text">{energyPercent}%</span>
            </div>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${energyPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* Travel advisory */}
        {(advisoryLoading || advisory) && (
          <section className="px-6 py-8 border-b border-border">
            <h3 className="text-lg font-semibold text-text mb-4">
              Australian Government Travel Advisory
            </h3>

            {advisoryLoading ? (
              <div className="space-y-2.5">
                <div className="h-3 bg-surface rounded-full w-full animate-pulse" />
                <div className="h-3 bg-surface rounded-full w-5/6 animate-pulse" />
                <div className="h-3 bg-surface rounded-full w-2/3 animate-pulse" />
              </div>
            ) : advisory ? (
              <div className={`rounded-2xl border p-5 ${ADVISORY_STYLES[advisory.adviceLevel].panel}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-sm font-semibold text-text">
                    {advisory.matchedCountry}
                  </p>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ADVISORY_STYLES[advisory.adviceLevel].badge}`}
                  >
                    Level {advisory.adviceLevel}
                  </span>
                </div>

                <p className="text-sm font-medium text-text mb-2">{advisory.adviceLabel}</p>
                <p className="text-sm text-muted leading-relaxed text-pretty">
                  {advisory.summary}
                </p>

                {advisory.regionalAdvisories.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted mb-1.5">
                      Regional Notes
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      {advisory.regionalAdvisories.slice(0, 3).map((note) => (
                        <li key={note} className="text-sm text-muted leading-relaxed">{note}</li>
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
                    className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                  >
                    Official source
                  </a>
                </div>
              </div>
            ) : null}
          </section>
        )}

        {/* About this city */}
        {(wikiLoading || wikiSummary) && (
          <section className="px-6 py-8 border-b border-border">
            <h3 className="text-lg font-semibold text-text mb-4">
              About {selectedCity.name}
            </h3>
            {wikiLoading ? (
              <div className="space-y-2.5">
                <div className="h-3 bg-surface rounded-full w-full animate-pulse" />
                <div className="h-3 bg-surface rounded-full w-5/6 animate-pulse" />
                <div className="h-3 bg-surface rounded-full w-4/6 animate-pulse" />
              </div>
            ) : (
              <p className="text-sm text-muted leading-relaxed text-pretty">
                {wikiSummary}
              </p>
            )}
          </section>
        )}

        {/* Planetary Influences */}
        <section className="px-6 py-8 border-b border-border">
          <h3 className="text-lg font-semibold text-text mb-6">
            Planetary Influences
          </h3>

          {uniqueLines.length > 0 ? (
            <div className="space-y-5">
              {uniqueLines.map((line) => (
                <div
                  key={`${line.planet}-${line.lineType}`}
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="size-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${PLANET_COLORS[line.planet]}18` }}
                    >
                      <div
                        className="size-4 rounded-full"
                        style={{ backgroundColor: PLANET_COLORS[line.planet] }}
                      />
                    </div>
                    <div>
                      <span className="text-base font-semibold text-text">{line.planet}</span>
                      <span className="text-sm text-muted mx-1.5">on</span>
                      <span className="text-sm font-semibold" style={{ color: PLANET_COLORS[line.planet] }}>
                        {LINE_LABELS[line.lineType]}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted leading-relaxed text-pretty">
                    {getInterpretation(line.planet, line.lineType)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted leading-relaxed text-pretty">
              No strong planetary lines pass directly through this city,
              but its energy may still resonate with your chart through proximity.
            </p>
          )}
        </section>

        {/* Recommended Activities */}
        <section className="px-6 py-8 border-b border-border">
          <h3 className="text-lg font-semibold text-text mb-6">
            Recommended Activities
          </h3>
          <div className="space-y-4">
            {[
              { title: 'Guided Walking Tour', desc: 'Explore the historic city center with a local guide', tag: 'Culture' },
              { title: 'Sunrise Yoga Session', desc: 'Start your day aligned at a scenic outdoor spot', tag: 'Wellness' },
              { title: 'Local Cooking Class', desc: 'Learn to prepare traditional regional dishes', tag: 'Food' },
              { title: 'Sound Healing Circle', desc: 'Group meditation with singing bowls and breathwork', tag: 'Spiritual' },
            ].map((a) => (
              <div key={a.title} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-semibold text-text">{a.title}</span>
                  <span className="text-xs font-medium text-accent bg-accent/10 px-2.5 py-1 rounded-full">{a.tag}</span>
                </div>
                <p className="text-sm text-muted leading-relaxed">{a.desc}</p>
                <p className="text-xs text-muted/50 mt-2 italic">Coming soon</p>
              </div>
            ))}
          </div>
        </section>

        {/* Hotels */}
        <section className="px-6 py-8">
          <h3 className="text-lg font-semibold text-text mb-6">
            Hotels
          </h3>
          <div className="space-y-4">
            {[
              { name: 'Grand Plaza Hotel', stars: 5, price: '$$$', note: 'Luxury stay in the heart of the city' },
              { name: 'The Artisan Boutique', stars: 4, price: '$$', note: 'Charming boutique hotel near old town' },
              { name: 'Serenity Inn', stars: 3, price: '$', note: 'Cozy and affordable with great reviews' },
            ].map((h) => (
              <div key={h.name} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-semibold text-text">{h.name}</span>
                  <span className="text-xs font-medium text-muted">{h.price}</span>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: h.stars }).map((_, i) => (
                    <span key={i} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-sm text-muted leading-relaxed">{h.note}</p>
                <p className="text-xs text-muted/50 mt-2 italic">Coming soon</p>
              </div>
            ))}
          </div>
        </section>

        {/* Flights */}
        <section className="px-6 py-8">
          <h3 className="text-lg font-semibold text-text mb-6">
            Flights
          </h3>
          <div className="space-y-4">
            {[
              { airline: 'SkyWay Airlines', route: 'Direct', duration: '3h 20m', price: '$349' },
              { airline: 'EuroJet', route: '1 stop', duration: '5h 45m', price: '$215' },
              { airline: 'Global Air', route: 'Direct', duration: '3h 05m', price: '$412' },
            ].map((f) => (
              <div key={f.airline} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-semibold text-text">{f.airline}</span>
                  <span className="text-sm font-semibold text-text">{f.price}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted">
                  <span>{f.route}</span>
                  <span>·</span>
                  <span>{f.duration}</span>
                </div>
                <p className="text-xs text-muted/50 mt-2 italic">Coming soon</p>
              </div>
            ))}
          </div>
        </section>

        <div className="h-6" />
      </div>
    </motion.div>
  )
}
