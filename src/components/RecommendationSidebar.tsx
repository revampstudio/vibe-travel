import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import { getNumerologyNeeds, rankCitiesByNumerology } from '../lib/recommendations.ts'
import { fetchTravelAdvisory } from '../lib/travelAdvisory.ts'
import type { CityWithEnergy, Planet } from '../types/index.ts'

const PLANET_COLORS: Record<Planet, string> = {
  Sun: '#F9A825', Moon: '#78909C', Mercury: '#00ACC1', Venus: '#E84393',
  Mars: '#E53935', Jupiter: '#6C5CE7', Saturn: '#A67C52',
  Uranus: '#42A5F5', Neptune: '#7E57C2', Pluto: '#455A64',
}

const MASTER_YEAR_BASE = new Map<number, number>([
  [11, 2],
  [22, 4],
  [33, 6],
])

function getCycleYearLabel(personalYear: number): string {
  const baseYear = MASTER_YEAR_BASE.get(personalYear)
  if (baseYear) {
    return `Master year ${personalYear} (amplified Year ${baseYear} energy)`
  }

  return `Year ${personalYear} of your 9-year cycle`
}

function getFocusAreas(personalYear: number): string[] {
  switch (personalYear) {
    case 1:
      return ['Start one meaningful new chapter.', 'Back your own decisions and take initiative.']
    case 2:
      return ['Deepen key relationships with patience.', 'Collaborate instead of forcing momentum.']
    case 3:
      return ['Create, publish, or share your voice.', 'Prioritize joy, expression, and visibility.']
    case 4:
      return ['Build repeatable systems and structure.', 'Commit to steady execution over speed.']
    case 5:
      return ['Say yes to expansion and movement.', 'Travel or change routines to unlock growth.']
    case 6:
      return ['Invest in home, family, and care.', 'Strengthen commitments and emotional harmony.']
    case 7:
      return ['Make space for study and introspection.', 'Choose depth and restoration over noise.']
    case 8:
      return ['Focus on career outcomes and leverage.', 'Lead, negotiate, and scale with discipline.']
    case 9:
      return ['Complete unfinished chapters.', 'Release what no longer matches who you are.']
    case 11:
      return ['Trust intuition and spiritual signals.', 'Share insight through inspired leadership.']
    case 22:
      return ['Build a long-term, real-world vision.', 'Turn big ideas into concrete systems.']
    case 33:
      return ['Lead through service and compassion.', 'Teach, mentor, or heal where needed most.']
    default:
      return ['Stay aligned with your core priorities.', 'Choose places that support your growth.']
  }
}

const INSIGHT_METHOD = 'These numbers are simple theme labels (not scores) based on Pythagorean numerology.'
type SidebarPanelMode = 'locations' | 'about'
type AdvisoryLevel = 1 | 2 | 3 | 4
type AdvisoryLevelMap = Record<string, AdvisoryLevel | null>

function advisoryTone(level: AdvisoryLevel | null): { label: string, className: string } | null {
  if (!level || level <= 1) return null
  if (level === 2) return { label: 'Travel advice level 2', className: 'bg-amber-50 text-amber-800 border-amber-200' }
  if (level === 3) return { label: 'Travel advice level 3', className: 'bg-orange-50 text-orange-800 border-orange-200' }
  return { label: 'Travel advice level 4', className: 'bg-red-50 text-red-800 border-red-200' }
}

export default function RecommendationSidebar() {
  const view = useStore((s) => s.view)
  const profile = useStore((s) => s.profile)
  const cities = useStore((s) => s.cities)
  const activeUtilityPanel = useStore((s) => s.activeUtilityPanel)
  const setActiveUtilityPanel = useStore((s) => s.setActiveUtilityPanel)
  const setSelectedCity = useStore((s) => s.setSelectedCity)
  const setView = useStore((s) => s.setView)
  const highlightedCity = useStore((s) => s.highlightedCity)
  const setHighlightedCity = useStore((s) => s.setHighlightedCity)
  const [panelMode, setPanelMode] = useState<SidebarPanelMode>('locations')
  const [advisoryLevelsByCountry, setAdvisoryLevelsByCountry] = useState<AdvisoryLevelMap>({})
  const cityKey = (city: CityWithEnergy) => `${city.name}|${city.country}`
  const expanded = activeUtilityPanel === 'insights'

  const needs = useMemo(
    () => (profile ? getNumerologyNeeds(profile) : null),
    [profile],
  )

  const ranked = useMemo(
    () => (profile && cities.length > 0 ? rankCitiesByNumerology(cities, profile) : []),
    [cities, profile],
  )
  const focusAreas = useMemo(() => getFocusAreas(profile?.personalYear ?? 1), [profile?.personalYear])
  const coreNumbers = useMemo(() => {
    if (!profile) return []

    return [
      {
        label: 'How You Naturally Operate',
        numerologyLabel: 'Life Path',
        value: profile.lifePathNumber,
        detail: profile.insights.lifePathMeaning,
      },
      {
        label: 'What Others Notice First',
        numerologyLabel: 'Birthday Number',
        value: profile.insights.birthdayNumber,
        detail: profile.insights.birthdayMeaning,
      },
      {
        label: 'Your First Response Style',
        numerologyLabel: 'Attitude Number',
        value: profile.insights.attitudeNumber,
        detail: profile.insights.attitudeMeaning,
      },
    ]
  }, [profile])
  const timingSnapshot = useMemo(() => {
    if (!profile) return []

    return [
      {
        label: 'Theme of This Month',
        numerologyLabel: 'Personal Month',
        value: profile.insights.personalMonth,
        detail: profile.insights.personalMonthMeaning,
      },
      {
        label: 'Theme of Next Year',
        numerologyLabel: 'Next Personal Year',
        value: profile.insights.nextPersonalYear,
        detail: `${profile.insights.nextLifeStage}. ${profile.insights.nextLifeStageDescription}`,
      },
    ]
  }, [profile])
  const yearlyBest = useMemo(() => {
    const goalFirst = [...ranked].sort((a, b) => (
      b.goalAlignment - a.goalAlignment
      || b.matchingInfluences.length - a.matchingInfluences.length
      || b.score - a.score
    ))

    return goalFirst
      .filter((item) => item.goalAlignment > 0 || item.matchingInfluences.length > 0)
      .slice(0, 6)
  }, [ranked])
  const overallBest = useMemo(
    () => [...ranked]
      .sort((a, b) => b.energyAlignment - a.energyAlignment || b.score - a.score)
      .slice(0, 6),
    [ranked],
  )
  const overallKeys = useMemo(
    () => new Set(overallBest.map((item) => cityKey(item.city))),
    [overallBest],
  )
  const visibleCountries = useMemo(
    () => Array.from(new Set(
      [...yearlyBest, ...overallBest].map((item) => item.city.country),
    )),
    [yearlyBest, overallBest],
  )

  useEffect(() => {
    const missingCountries = visibleCountries.filter(
      (country) => !Object.prototype.hasOwnProperty.call(advisoryLevelsByCountry, country),
    )
    if (missingCountries.length === 0) return

    let cancelled = false

    Promise.all(
      missingCountries.map(async (country) => {
        const advisory = await fetchTravelAdvisory(country)
        return {
          country,
          level: advisory.status === 'ok' ? advisory.advisory.adviceLevel : null,
        }
      }),
    ).then((entries) => {
      if (cancelled) return

      setAdvisoryLevelsByCountry((current) => {
        let changed = false
        const next: AdvisoryLevelMap = { ...current }
        for (const entry of entries) {
          if (Object.prototype.hasOwnProperty.call(next, entry.country)) continue
          next[entry.country] = entry.level
          changed = true
        }
        return changed ? next : current
      })
    })

    return () => {
      cancelled = true
    }
  }, [visibleCountries, advisoryLevelsByCountry])

  if (!profile || !needs || ranked.length === 0) return null

  const handleCityClick = (city: CityWithEnergy) => {
    setActiveUtilityPanel(null)
    setSelectedCity(city)
    setView('detail')
  }

  return (
    <>
      {activeUtilityPanel === null && (
        <div className={`absolute left-4 top-[4.25rem] z-[24] ${view === 'detail' ? 'hidden lg:block' : 'block'}`}>
          <button
            className="floating-control flex min-h-[48px] items-center gap-2.5 rounded-full pl-2.5 pr-3 text-left transition hover:border-border-strong hover:bg-white sm:min-h-[52px] sm:gap-3 sm:pl-3 sm:pr-3.5"
            onClick={() => setActiveUtilityPanel('insights')}
            aria-label="Open insights panel"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent sm:h-9 sm:w-9">
              <svg className="size-4 sm:size-[1.05rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-text">Insights</span>
            <span className="hidden rounded-full bg-surface-soft px-2.5 py-1 text-xs font-semibold text-muted sm:inline-flex">
              Year {profile.personalYear}
            </span>
            <svg className="size-3.5 text-muted sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="panel"
            className={`floating-panel absolute bottom-4 left-4 top-[4.25rem] z-[34] w-[calc(100%-2rem)] max-w-[25rem] flex-col rounded-[2rem] ${view === 'detail' ? 'hidden lg:flex' : 'flex'}`}
            initial={{ x: -420 }}
            animate={{ x: 0 }}
            exit={{ x: -420 }}
            transition={{ type: 'spring', damping: 33, stiffness: 290 }}
          >
            <div className="flex h-full min-h-0 flex-col px-5 pb-5 pt-5 md:px-6 md:pb-6 md:pt-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent-strong">
                      Year {profile.personalYear}
                    </span>
                    <span className="text-xs font-medium text-muted">{profile.lifeStage}</span>
                  </div>
                  <h2 className="font-serif text-[1.5rem] leading-tight text-text">
                    {panelMode === 'locations' ? 'Best-fit places' : 'Your cycle'}
                  </h2>
                  <p className="mt-1.5 max-w-[18rem] text-sm leading-relaxed text-muted">
                    {panelMode === 'locations'
                      ? 'Cities that match your current cycle and strongest lines.'
                      : 'A plain-language view of your numerology themes and timing.'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveUtilityPanel(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-white text-muted transition hover:border-border-strong hover:bg-surface-soft hover:text-text"
                  aria-label="Collapse panel"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>

              <div className="mb-5 flex rounded-2xl border border-border/80 bg-surface-soft p-1">
                <button
                  type="button"
                  onClick={() => setPanelMode('locations')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    panelMode === 'locations'
                      ? 'bg-white text-text shadow-[0_10px_18px_-16px_rgba(17,24,39,0.25)]'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  Locations
                </button>
                <button
                  type="button"
                  onClick={() => setPanelMode('about')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    panelMode === 'about'
                      ? 'bg-white text-text shadow-[0_10px_18px_-16px_rgba(17,24,39,0.25)]'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  About
                </button>
              </div>

              <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1">
                {panelMode === 'locations' && (
                  <section className="rounded-[1.4rem] border border-border/80 bg-surface-soft px-4 py-4">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-accent-strong">
                      Why these places lead
                    </p>
                    <p className="text-sm leading-relaxed text-text">
                      Year {profile.personalYear} ({profile.lifeStage}): {needs.description}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      Ranking blend: yearly fit and overall alignment energy.
                    </p>
                  </section>
                )}

                {panelMode === 'about' && (
                  <section className="rounded-[1.4rem] border border-border/80 bg-surface-soft px-4 py-4">
                    <p className="text-sm font-semibold text-text">{profile.lifeStage}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{profile.lifeStageDescription}</p>
                  </section>
                )}

                {panelMode === 'about' && (
                  <section className="space-y-3 rounded-[1.4rem] border border-border/85 bg-white px-4 py-4 shadow-[0_14px_28px_-26px_rgba(17,24,39,0.26)]">
                    <div>
                      <h3 className="text-sm font-semibold text-text">Your cycle snapshot</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {getCycleYearLabel(profile.personalYear)}. {profile.lifeStageDescription}
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">{INSIGHT_METHOD}</p>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                        Focus right now
                      </p>
                      <ul className="space-y-1.5">
                        {focusAreas.map((focus) => (
                          <li key={focus} className="flex items-start gap-2.5 text-sm leading-relaxed text-text">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span>{focus}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">Core numbers</p>
                      <div className="space-y-2.5">
                        {coreNumbers.map((item) => (
                          <div key={item.label} className="rounded-xl border border-border/75 bg-surface px-3 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{item.numerologyLabel}</p>
                              <span className="text-sm font-semibold text-text">No. {item.value}</span>
                            </div>
                            <p className="mt-1.5 text-sm text-text">{item.label}</p>
                            <p className="mt-1 text-sm leading-relaxed text-muted">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">Timing snapshot</p>
                      <div className="space-y-2.5">
                        {timingSnapshot.map((item) => (
                          <div key={item.label} className="rounded-xl border border-border/75 bg-surface px-3 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{item.numerologyLabel}</p>
                              <span className="text-sm font-semibold text-text">No. {item.value}</span>
                            </div>
                            <p className="mt-1.5 text-sm text-text">{item.label}</p>
                            <p className="mt-1 text-sm leading-relaxed text-muted">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {panelMode === 'locations' && (
                  <>
                    <section className="space-y-2.5">
                      <div className="px-0.5">
                        <h3 className="text-sm font-semibold text-text">Best for this year</h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          The clearest matches for your current cycle and line pattern.
                        </p>
                      </div>

                      {yearlyBest.length === 0 && (
                        <p className="rounded-xl border border-border/80 bg-surface px-3.5 py-3 text-sm leading-relaxed text-muted">
                          No strong yearly matches in this map slice yet. Check overall best places for strong energy options.
                        </p>
                      )}

                        {yearlyBest.map(({ city, reason, matchingInfluences, goalAlignment, energyAlignment }) => {
                        const key = cityKey(city)
                        const isHighlighted = highlightedCity === key
                        const yearlyPercent = Math.round(goalAlignment * 100)
                        const energyPercent = Math.round(energyAlignment * 100)
                        const isDualMatch = overallKeys.has(key)
                        const advisoryLevel = advisoryLevelsByCountry[city.country] ?? null
                        const advisory = advisoryTone(advisoryLevel)

                        return (
                          <button
                            key={`yearly-${key}`}
                            className={`w-full rounded-[1.35rem] border px-4 py-4 text-left transition-all duration-150 ${
                              isHighlighted
                                ? 'border-accent/25 bg-white shadow-[0_18px_34px_-26px_rgba(227,28,75,0.3)]'
                                : 'border-border/80 bg-white shadow-[0_12px_26px_-24px_rgba(17,24,39,0.2)] hover:border-border-strong hover:bg-surface'
                            }`}
                            onClick={() => handleCityClick(city)}
                            onMouseEnter={() => setHighlightedCity(key)}
                            onMouseLeave={() => setHighlightedCity(null)}
                          >
                            <div className="mb-2 flex items-baseline justify-between gap-2">
                              <p className="text-[15px] font-semibold text-text">
                                {city.name}
                                <span className="ml-1.5 text-sm font-medium text-muted">{city.country}</span>
                              </p>
                            </div>

                            <div className="mb-2.5 flex flex-wrap gap-1.5">
                              <span className="rounded-full border border-accent/15 bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent-strong">
                                Yearly {yearlyPercent}%
                              </span>
                              <span className="rounded-full border border-border-strong/70 bg-surface-soft px-2.5 py-1 text-xs font-semibold text-text">
                                Energy {energyPercent}%
                              </span>
                              {isDualMatch && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                  High energy too
                                </span>
                              )}
                              {advisory && (
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${advisory.className}`}>
                                  {advisory.label}
                                </span>
                              )}
                            </div>

                            {matchingInfluences.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {matchingInfluences.slice(0, 2).map((influence) => (
                                  <span
                                    key={`${key}-${influence.planet}-${influence.lineType}`}
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                                    style={{
                                      backgroundColor: `${PLANET_COLORS[influence.planet]}14`,
                                      color: PLANET_COLORS[influence.planet],
                                    }}
                                  >
                                    <span
                                      className="inline-block h-1.5 w-1.5 rounded-full"
                                      style={{ backgroundColor: PLANET_COLORS[influence.planet] }}
                                    />
                                    {influence.label}
                                  </span>
                                ))}
                              </div>
                            )}

                            <p className="text-sm leading-relaxed text-muted">{reason}</p>
                          </button>
                        )
                      })}
                    </section>

                    <section className="space-y-2.5 pt-1">
                      <div className="px-0.5">
                        <h3 className="text-sm font-semibold text-text">Highest alignment overall</h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          Strongest places on the map, regardless of your current year.
                        </p>
                      </div>

                        {overallBest.map(({ city, reason, matchingInfluences, isTopEnergyPick, energyAlignment, goalAlignment }) => {
                        const key = cityKey(city)
                        const isHighlighted = highlightedCity === key
                        const energyPercent = Math.round(energyAlignment * 100)
                        const yearlyPercent = Math.round(goalAlignment * 100)
                        const advisoryLevel = advisoryLevelsByCountry[city.country] ?? null
                        const advisory = advisoryTone(advisoryLevel)

                        return (
                          <button
                            key={`overall-${key}`}
                            className={`w-full rounded-[1.35rem] border px-4 py-4 text-left transition-all duration-150 ${
                              isHighlighted
                                ? 'border-accent/25 bg-white shadow-[0_18px_34px_-26px_rgba(227,28,75,0.3)]'
                                : 'border-border/80 bg-white shadow-[0_12px_26px_-24px_rgba(17,24,39,0.2)] hover:border-border-strong hover:bg-surface'
                            }`}
                            onClick={() => handleCityClick(city)}
                            onMouseEnter={() => setHighlightedCity(key)}
                            onMouseLeave={() => setHighlightedCity(null)}
                          >
                            <div className="mb-2 flex items-baseline justify-between gap-2">
                              <p className="text-[15px] font-semibold text-text">
                                {city.name}
                                <span className="ml-1.5 text-sm font-medium text-muted">{city.country}</span>
                              </p>
                            </div>

                            <div className="mb-2.5 flex flex-wrap gap-1.5">
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                Energy {energyPercent}%
                              </span>
                              {isTopEnergyPick && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                  Top energy
                                </span>
                              )}
                              {yearlyPercent > 0 && (
                                <span className="rounded-full border border-accent/15 bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent-strong">
                                  Yearly {yearlyPercent}%
                                </span>
                              )}
                              {advisory && (
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${advisory.className}`}>
                                  {advisory.label}
                                </span>
                              )}
                            </div>

                            {matchingInfluences.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {matchingInfluences.slice(0, 2).map((influence) => (
                                  <span
                                    key={`${key}-overall-${influence.planet}-${influence.lineType}`}
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                                    style={{
                                      backgroundColor: `${PLANET_COLORS[influence.planet]}14`,
                                      color: PLANET_COLORS[influence.planet],
                                    }}
                                  >
                                    <span
                                      className="inline-block h-1.5 w-1.5 rounded-full"
                                      style={{ backgroundColor: PLANET_COLORS[influence.planet] }}
                                    />
                                    {influence.label}
                                  </span>
                                ))}
                              </div>
                            )}

                            <p className="text-sm leading-relaxed text-muted">{reason}</p>
                          </button>
                        )
                      })}
                    </section>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
