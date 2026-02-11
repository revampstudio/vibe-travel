import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import { getInterpretation } from '../lib/interpretations.ts'
import type { Planet, LineType } from '../types/index.ts'

const wikiCache = new Map<string, string>()

function useWikiSummary(cityName: string, country: string) {
  const [summary, setSummary] = useState<string | null>(wikiCache.get(cityName) ?? null)
  const [loading, setLoading] = useState(!wikiCache.has(cityName))

  useEffect(() => {
    if (!cityName) {
      setLoading(false)
      return
    }

    if (wikiCache.has(cityName)) {
      setSummary(wikiCache.get(cityName)!)
      setLoading(false)
      return
    }

    setLoading(true)
    setSummary(null)

    const controller = new AbortController()
    const encoded = encodeURIComponent(cityName.replace(/ /g, '_'))

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const text = data.extract ?? ''
        wikiCache.set(cityName, text)
        setSummary(text)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          wikiCache.set(cityName, '')
          setSummary('')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [cityName, country])

  return { summary, loading }
}

const PLANET_COLORS: Record<Planet, string> = {
  Sun: '#F9A825', Moon: '#78909C', Mercury: '#00ACC1', Venus: '#E84393',
  Mars: '#E53935', Jupiter: '#6C5CE7', Saturn: '#546E7A',
  Uranus: '#42A5F5', Neptune: '#7E57C2', Pluto: '#455A64',
}

const LINE_LABELS: Record<LineType, string> = {
  MC: 'Midheaven', IC: 'Imum Coeli', ASC: 'Ascendant', DSC: 'Descendant',
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
