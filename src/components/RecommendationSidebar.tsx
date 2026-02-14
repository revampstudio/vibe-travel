import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore.ts'
import { getNumerologyNeeds, rankCitiesByNumerology } from '../lib/recommendations.ts'
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

export default function RecommendationSidebar() {
  const profile = useStore((s) => s.profile)
  const cities = useStore((s) => s.cities)
  const setSelectedCity = useStore((s) => s.setSelectedCity)
  const setView = useStore((s) => s.setView)
  const highlightedCity = useStore((s) => s.highlightedCity)
  const setHighlightedCity = useStore((s) => s.setHighlightedCity)
  const [expanded, setExpanded] = useState(false)
  const [panelMode, setPanelMode] = useState<SidebarPanelMode>('locations')
  const cityKey = (city: CityWithEnergy) => `${city.name}|${city.country}`

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

  if (!profile || !needs || ranked.length === 0) return null

  const handleCityClick = (city: CityWithEnergy) => {
    setSelectedCity(city)
    setView('detail')
  }
  const openPanel = (mode: SidebarPanelMode) => {
    setPanelMode(mode)
    setExpanded(true)
  }

  return (
    <>
      {/* ── Launcher buttons: always rendered, sit near settings, behind panel when open ── */}
      <button
        className="absolute top-[4.25rem] left-4 z-[15] size-10 rounded-xl bg-white/90 backdrop-blur-md
                   border border-border/60 shadow-sm flex items-center justify-center
                   cursor-pointer hover:bg-white transition-colors"
        onClick={() => openPanel('locations')}
        aria-label="Show recommended locations"
      >
        <svg className="size-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>
      <button
        className="absolute top-[7.5rem] left-4 z-[15] size-10 rounded-xl bg-white/90 backdrop-blur-md
                   border border-border/60 shadow-sm flex items-center justify-center
                   cursor-pointer hover:bg-white transition-colors"
        onClick={() => openPanel('about')}
        aria-label="Show about you insights"
      >
        <svg className="size-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20.25a7.5 7.5 0 0115 0" />
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
                    {panelMode === 'locations' ? 'Recommended Locations' : 'About You'}
                  </h2>
                  <p className="text-[10px] text-muted mt-1">
                    {panelMode === 'locations'
                      ? 'Best cities for your cycle and raw energy.'
                      : 'Your numerology themes in plain language.'}
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
                className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-2.5"
                style={{ scrollbarWidth: 'thin' }}
              >
                {panelMode === 'locations' && (
                  <div className="rounded-xl bg-accent/5 border border-accent/15 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-accent mb-1.5">
                      Why these places rank first
                    </p>
                    <p className="text-xs text-muted leading-relaxed">
                      Year {profile.personalYear} ({profile.lifeStage}): {needs.description}
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted leading-relaxed">
                      Ranking method: 60% match to your year&apos;s key planet-lines + 40% proximity energy from how
                      close the city is to your planetary paths.
                    </p>
                  </div>
                )}

                {panelMode === 'about' && (
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
                      {profile.lifeStageDescription}
                    </p>
                  </div>
                )}

                {/* About you card */}
                {panelMode === 'about' && (
                  <section className="rounded-xl border border-border/60 bg-white p-3.5 space-y-3">
                    <div>
                      <h3 className="text-xs font-semibold text-text">About You</h3>
                      <p className="text-[11px] text-muted leading-relaxed mt-1">
                        {getCycleYearLabel(profile.personalYear)}. {profile.lifeStageDescription}
                      </p>
                      <p className="text-[10px] text-muted leading-relaxed mt-1.5">
                        {INSIGHT_METHOD}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">
                        Focus Right Now
                      </p>
                      <ul className="space-y-1.5">
                        {focusAreas.map((focus) => (
                          <li key={focus} className="flex items-start gap-2 text-[11px] text-text">
                            <span className="mt-1 size-1.5 rounded-full bg-accent/70 flex-shrink-0" />
                            <span>{focus}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">
                        Core Numbers
                      </p>
                      <p className="text-[10px] text-muted leading-relaxed mb-2">
                        Plain-language summary of your core tendencies.
                      </p>
                      <div className="space-y-2">
                        {coreNumbers.map((item) => (
                          <div key={item.label} className="rounded-lg border border-border/60 bg-surface/45 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{item.label}</p>
                              <span className="text-xs font-semibold text-text">No. {item.value}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted leading-relaxed">{item.detail}</p>
                            <p className="mt-1 text-[10px] text-muted leading-relaxed">
                              Numerology label: {item.numerologyLabel}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">
                        Timing Snapshot
                      </p>
                      <p className="text-[10px] text-muted leading-relaxed mb-2">
                        What to focus on now and what is coming next.
                      </p>
                      <div className="space-y-2">
                        {timingSnapshot.map((item) => (
                          <div key={item.label} className="rounded-lg border border-border/60 bg-white p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{item.label}</p>
                              <span className="text-xs font-semibold text-text">No. {item.value}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted leading-relaxed">{item.detail}</p>
                            <p className="mt-1 text-[10px] text-muted leading-relaxed">
                              Numerology label: {item.numerologyLabel}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                  </section>
                )}

                {panelMode === 'locations' && (
                  <>
                {/* Yearly best places */}
                <section className="space-y-2">
                  <div className="px-0.5">
                    <h3 className="text-[11px] font-semibold text-text uppercase tracking-wide">
                      Yearly Best Places
                    </h3>
                    <p className="text-[10px] text-muted mt-1">
                      These combine your Year {profile.personalYear} planet-line matches with line proximity energy.
                    </p>
                  </div>
                  {yearlyBest.length === 0 && (
                    <p className="rounded-xl border border-border/60 bg-white p-3 text-[11px] text-muted leading-relaxed">
                      No strong yearly goal matches found in your current map slice. Check Overall Best Places for
                      high-energy options.
                    </p>
                  )}
                  {yearlyBest.map(({ city, reason, matchingInfluences, goalAlignment, energyAlignment }) => {
                    const key = cityKey(city)
                    const isHighlighted = highlightedCity === key
                    const yearlyPercent = Math.round(goalAlignment * 100)
                    const energyPercent = Math.round(energyAlignment * 100)
                    const isDualMatch = overallKeys.has(key)

                    return (
                      <button
                        key={`yearly-${key}`}
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
                        <div className="flex items-baseline justify-between mb-2">
                          <div>
                            <span className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                              {city.name}
                            </span>
                            <span className="text-xs text-muted ml-1.5">{city.country}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                            Yearly match {yearlyPercent}%
                          </span>
                          {isDualMatch && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              Also high energy
                            </span>
                          )}
                        </div>

                        {matchingInfluences.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {matchingInfluences.slice(0, 2).map((inf) => (
                              <span
                                key={`${key}-${inf.planet}-${inf.lineType}`}
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

                        <p className="text-[11px] text-muted leading-relaxed mb-2">
                          {reason}
                        </p>

                        <p className="text-[10px] font-medium text-muted">
                          Energy alignment: <span className="font-semibold text-text">{energyPercent}%</span>
                        </p>
                      </button>
                    )
                  })}
                </section>

                {/* Overall best places */}
                <section className="space-y-2 pt-1">
                  <div className="px-0.5">
                    <h3 className="text-[11px] font-semibold text-text uppercase tracking-wide">
                      Overall Best Places
                    </h3>
                    <p className="text-[10px] text-muted mt-1">
                      Highest raw-energy cities on your map, regardless of yearly cycle.
                    </p>
                  </div>
                  {overallBest.map(({ city, reason, matchingInfluences, isTopEnergyPick, energyAlignment, goalAlignment }) => {
                    const key = cityKey(city)
                    const isHighlighted = highlightedCity === key
                    const energyPercent = Math.round(energyAlignment * 100)
                    const yearlyPercent = Math.round(goalAlignment * 100)

                    return (
                      <button
                        key={`overall-${key}`}
                        className={`w-full text-left rounded-xl border bg-white p-3.5
                                    transition-all duration-150 cursor-pointer group
                                    ${isHighlighted
                                      ? 'border-l-2 border-l-emerald-600 border-t-border/60 border-r-border/60 border-b-border/60 bg-emerald-50/40'
                                      : 'border-border/60 hover:bg-surface/80'
                                    }`}
                        onClick={() => handleCityClick(city)}
                        onMouseEnter={() => setHighlightedCity(key)}
                        onMouseLeave={() => setHighlightedCity(null)}
                      >
                        <div className="flex items-baseline justify-between mb-2">
                          <div>
                            <span className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                              {city.name}
                            </span>
                            <span className="text-xs text-muted ml-1.5">{city.country}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Energy {energyPercent}%
                          </span>
                          {isTopEnergyPick && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              Top energy
                            </span>
                          )}
                          {yearlyPercent > 0 && (
                            <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                              Yearly match {yearlyPercent}%
                            </span>
                          )}
                        </div>

                        {matchingInfluences.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {matchingInfluences.slice(0, 2).map((inf) => (
                              <span
                                key={`${key}-overall-${inf.planet}-${inf.lineType}`}
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

                        <p className="text-[11px] text-muted leading-relaxed">
                          {reason}
                        </p>
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
