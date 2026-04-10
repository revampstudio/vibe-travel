import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  SlideInDown,
  SlideInLeft,
  SlideInRight,
  SlideOutDown,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { WorldMapCard } from '@/src/components/world-map-card'
import { PLANET_COLORS, PLANETS, computeAstroLines } from '@/src/lib/astrocartography'
import { preloadBirthCityAutocomplete, searchBirthCities, type GeoResult } from '@/src/lib/birthCityAutocomplete'
import { enrichCitiesWithEnergy } from '@/src/lib/geo'
import { getInterpretation } from '@/src/lib/interpretations'
import { ENERGY_TIERS, LINE_TYPE_STYLES } from '@/src/lib/mapGuidance'
import { calcSoulProfile } from '@/src/lib/numerology'
import { getNumerologyNeeds, rankCitiesByNumerology } from '@/src/lib/recommendations'
import { fetchTravelAdvisory, type TravelAdvisoryLookup } from '@/src/lib/travelAdvisory'
import { fetchCityWikiSummary } from '@/src/lib/wiki'
import { loadCities } from '@/src/data/loadCities'
import { useStore } from '@/src/store/useStore'
import type { BirthData, CityWithEnergy, LineType, Planet, UtilityPanelState } from '@/src/types'
import { colors, fonts, radii, shadows } from '@/src/theme'
import { cityKey } from '@/src/utils/cityKey'

const MASTER_YEAR_BASE = new Map<number, number>([
  [11, 2],
  [22, 4],
  [33, 6],
])

const LINE_LABELS: Record<LineType, string> = {
  MC: 'Midheaven',
  IC: 'Imum Coeli',
  ASC: 'Ascendant',
  DSC: 'Descendant',
}

const ADVISORY_STYLES: Record<1 | 2 | 3 | 4, { panel: string, badgeBg: string, badgeText: string }> = {
  1: { panel: '#ECFDF3', badgeBg: '#D1FADF', badgeText: '#067647' },
  2: { panel: '#FFF8E8', badgeBg: '#FDE7B2', badgeText: '#9A6700' },
  3: { panel: '#FFF1E7', badgeBg: '#FCD0AE', badgeText: '#B54708' },
  4: { panel: '#FFF0F0', badgeBg: '#FEE4E2', badgeText: '#B42318' },
}

const SUGGESTED_EXPERIENCES = [
  {
    title: 'Architectural Morning Walk',
    desc: 'A calm design-led route through signature streets and local landmarks.',
    tag: 'Culture',
  },
  {
    title: 'Sunrise Movement Session',
    desc: 'Breathwork and light movement in a scenic open-air setting.',
    tag: 'Wellness',
  },
  {
    title: 'Regional Tasting Evening',
    desc: 'A chef-led introduction to the place through local ingredients.',
    tag: 'Food',
  },
] as const

const INSIGHT_METHOD = 'Theme labels are based on Pythagorean numerology, then blended with your strongest map lines.'

type AdvisoryLevelMap = Record<string, 1 | 2 | 3 | 4 | null>
type InsightTab = 'locations' | 'about'

function getCycleYearLabel(personalYear: number): string {
  const baseYear = MASTER_YEAR_BASE.get(personalYear)
  if (baseYear) {
    return `Master year ${personalYear} with amplified Year ${baseYear} energy`
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

function formatAdvisoryDate(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Date unavailable'

  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (!(error instanceof Error)) return false

  return (
    error.name === 'AbortError'
    || /aborted/i.test(error.message)
  )
}

function useWikiSummary(city: CityWithEnergy | null) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!city) return

    let cancelled = false
    const controller = new AbortController()

    setLoading(true)
    setSummary(null)

    void fetchCityWikiSummary(city.name, city.country, city.lat, city.lng, controller.signal)
      .then((result) => {
        if (!cancelled) setSummary(result?.summary ?? null)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        console.error('Failed to load city summary', error)
        if (!cancelled) setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [city])

  return { summary, loading }
}

function useTravelAdvisory(country: string) {
  const [advisoryState, setAdvisoryState] = useState<TravelAdvisoryLookup | null>(null)

  useEffect(() => {
    if (!country) return

    let cancelled = false
    const controller = new AbortController()

    setAdvisoryState(null)
    void fetchTravelAdvisory(country, controller.signal)
      .then((result) => {
        if (!cancelled) setAdvisoryState(result)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        console.error('Failed to load travel advisory', error)
        if (!cancelled) setAdvisoryState({ status: 'unavailable' })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [country])

  return advisoryState
}

function FloatingButton({
  active = false,
  onPress,
}: {
  active?: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.floatingButton, active ? styles.floatingButtonActive : null]}>
      <GearIcon active={active} />
    </Pressable>
  )
}

function GearIcon({ active }: { active: boolean }) {
  if (Platform.OS === 'web') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
          stroke={active ? '#FFFFFF' : 'rgba(31,36,48,0.72)'}
          strokeWidth="1.5"
        />
        <path
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          stroke={active ? '#FFFFFF' : 'rgba(31,36,48,0.72)'}
          strokeWidth="1.5"
        />
      </svg>
    )
  }

  return <Text style={[styles.floatingButtonIcon, active ? styles.floatingButtonIconActive : null]}>⚙</Text>
}

function SparkleIcon() {
  if (Platform.OS === 'web') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          stroke="#FF385C"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  return <Text style={styles.insightsTriggerIcon}>✦</Text>
}

function InsightsTrigger({
  lifeStage,
  onPress,
}: {
  lifeStage: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={styles.insightsTrigger}>
      <SparkleIcon />
      <Text style={styles.visuallyHidden}>{lifeStage}</Text>
    </Pressable>
  )
}

function LineStylePreview({ lineType }: { lineType: LineType }) {
  if (lineType === 'MC') {
    return <View style={styles.linePreviewSolid} />
  }

  if (lineType === 'IC') {
    return (
      <View style={styles.linePreviewRow}>
        <View style={styles.linePreviewDashLong} />
        <View style={styles.linePreviewGap} />
        <View style={styles.linePreviewDashLong} />
        <View style={styles.linePreviewGap} />
        <View style={styles.linePreviewDashLong} />
      </View>
    )
  }

  if (lineType === 'ASC') {
    return (
      <View style={styles.linePreviewRow}>
        <View style={styles.linePreviewDot} />
        <View style={styles.linePreviewGap} />
        <View style={styles.linePreviewDot} />
        <View style={styles.linePreviewGap} />
        <View style={styles.linePreviewDot} />
        <View style={styles.linePreviewGap} />
        <View style={styles.linePreviewDot} />
      </View>
    )
  }

  return (
    <View style={styles.linePreviewRow}>
      <View style={styles.linePreviewDashLong} />
      <View style={styles.linePreviewGap} />
      <View style={styles.linePreviewDot} />
      <View style={styles.linePreviewGap} />
      <View style={styles.linePreviewDashLong} />
    </View>
  )
}

function Drawer({
  children,
  title,
  subtitle,
  onClose,
  width,
  height,
  top,
  variant = 'left',
}: {
  children: ReactNode
  title: string
  subtitle: string
  onClose: () => void
  width: number
  height: number
  top: number
  variant?: 'left' | 'right' | 'sheet'
}) {
  const entering = variant === 'left'
    ? SlideInLeft.springify().damping(30).stiffness(260)
    : variant === 'right'
      ? SlideInRight.springify().damping(30).stiffness(260)
      : SlideInDown.springify().damping(30).stiffness(260)

  const exiting = variant === 'left'
    ? SlideOutLeft.duration(180)
    : variant === 'right'
      ? SlideOutRight.duration(180)
      : SlideOutDown.duration(180)

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      style={[
        styles.drawer,
        variant === 'sheet'
          ? {
              left: 0,
              right: 0,
              bottom: 0,
              height,
            }
          : variant === 'left'
            ? {
                left: 0,
                top: 0,
                bottom: 0,
                width,
                paddingTop: top + 6,
              }
          : {
              top,
              height,
              width,
              right: 12,
            },
        variant === 'sheet' ? styles.drawerSheet : null,
        variant === 'left' ? styles.drawerLeft : null,
      ]}
    >
      <View style={styles.drawerHeader}>
        <View style={styles.drawerHeaderCopy}>
          <Text style={styles.drawerEyebrow}>{subtitle}</Text>
          <Text style={styles.drawerTitle}>{title}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>
      {children}
    </Animated.View>
  )
}

function SettingsDrawer({
  width,
  height,
  top,
  onClose,
}: {
  width: number
  height: number
  top: number
  onClose: () => void
}) {
  const birthData = useStore((state) => state.birthData)
  const setBirthData = useStore((state) => state.setBirthData)
  const setProfile = useStore((state) => state.setProfile)
  const setAstroLines = useStore((state) => state.setAstroLines)
  const setCities = useStore((state) => state.setCities)
  const setSelectedCity = useStore((state) => state.setSelectedCity)
  const setView = useStore((state) => state.setView)

  const [date, setDate] = useState(birthData?.date ?? '')
  const [time, setTime] = useState(birthData?.time ?? '12:00')
  const [cityQuery, setCityQuery] = useState(birthData?.city ?? '')
  const [cityResults, setCityResults] = useState<GeoResult[]>([])
  const [selectedGeo, setSelectedGeo] = useState<GeoResult | null>(
    birthData ? { place_name: birthData.city, center: [birthData.lng, birthData.lat] } : null,
  )
  const [showResults, setShowResults] = useState(false)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestIdRef = useRef(0)

  useEffect(() => {
    void preloadBirthCityAutocomplete()
  }, [])

  useEffect(() => {
    if (!showResults) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const requestId = ++searchRequestIdRef.current

      if (cityQuery.trim().length < 2) {
        setCityResults([])
        return
      }

      void searchBirthCities(cityQuery, {
        limit: 5,
        includeMapbox: true,
        mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
      }).then((results) => {
        if (requestId === searchRequestIdRef.current) {
          setCityResults(results)
        }
      })
    }, 260)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [cityQuery, showResults])

  const isValid = Boolean(date && selectedGeo)

  const handleSave = async () => {
    if (!isValid || !selectedGeo) return

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
    const sourceCities = await loadCities()
    const enrichedCities = enrichCitiesWithEnergy(sourceCities, astroLines)

    setBirthData(newBirth)
    setProfile(profile)
    setAstroLines(astroLines)
    setCities(enrichedCities)
    setSelectedCity(null)
    setView('globe')

    setSaving(false)
    onClose()
  }

  return (
    <Drawer title="Update your details" subtitle="Settings" onClose={onClose} width={width} height={height} top={top} variant="left">
      <ScrollView
        contentContainerStyle={styles.drawerScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionBlock}>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput value={date} onChangeText={setDate} style={styles.input} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Time</Text>
              <TextInput value={time} onChangeText={setTime} style={styles.input} placeholder="HH:MM" />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Birth city</Text>
            <TextInput
              value={cityQuery}
              onChangeText={(value) => {
                setCityQuery(value)
                setSelectedGeo(null)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
              style={styles.input}
              placeholder="Search city"
            />
            {showResults && cityResults.length > 0 ? (
              <View style={styles.resultsList}>
                {cityResults.map((result) => (
                  <Pressable
                    key={`${result.place_name}-${result.center.join(',')}`}
                    onPress={() => {
                      setSelectedGeo(result)
                      setCityQuery(result.place_name)
                      setShowResults(false)
                    }}
                    style={styles.resultItem}
                  >
                    <Text style={styles.resultText}>{result.place_name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              void handleSave()
            }}
            disabled={!isValid || saving}
            style={[styles.primaryAction, !isValid || saving ? styles.primaryActionDisabled : null]}
          >
            <Text style={styles.primaryActionText}>{saving ? 'Recalculating...' : 'Update map'}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitleSmall}>Map guide</Text>

          <View style={styles.legendGroup}>
            <Text style={styles.legendHeading}>Dot color = energy</Text>
            <View style={styles.legendWrap}>
              {ENERGY_TIERS.map((tier) => (
                <View key={tier.id} style={styles.legendChip}>
                  <View style={[styles.legendDot, { backgroundColor: tier.color }]} />
                  <Text style={styles.legendText}>{tier.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.legendGroup}>
            <Text style={styles.legendHeading}>Line color = planet</Text>
            <View style={styles.legendWrap}>
              {PLANETS.map((planet) => (
                <View key={planet} style={styles.legendChip}>
                  <View style={[styles.legendDot, { backgroundColor: PLANET_COLORS[planet] }]} />
                  <Text style={styles.legendText}>{planet}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.legendGroup}>
            <Text style={styles.legendHeading}>Line styles</Text>
              {LINE_TYPE_STYLES.map((style) => (
                <View key={style.lineType} style={styles.lineStyleRow}>
                  <View style={styles.lineStyleCopy}>
                    <Text style={styles.lineStyleLabel}>{style.lineType} · {style.label}</Text>
                    <Text style={styles.lineStyleContext}>{style.context}</Text>
                  </View>
                  <LineStylePreview lineType={style.lineType} />
                </View>
              ))}
            </View>
        </View>
      </ScrollView>
    </Drawer>
  )
}

function InsightsDrawer({
  width,
  height,
  top,
  onClose,
  onCityPress,
}: {
  width: number
  height: number
  top: number
  onClose: () => void
  onCityPress: (city: CityWithEnergy) => void
}) {
  const profile = useStore((state) => state.profile)
  const cities = useStore((state) => state.cities)
  const highlightedCity = useStore((state) => state.highlightedCity)
  const setHighlightedCity = useStore((state) => state.setHighlightedCity)
  const [tab, setTab] = useState<InsightTab>('locations')
  const [advisoryLevelsByCountry, setAdvisoryLevelsByCountry] = useState<AdvisoryLevelMap>({})

  const needs = useMemo(() => (profile ? getNumerologyNeeds(profile) : null), [profile])
  const ranked = useMemo(() => (profile ? rankCitiesByNumerology(cities, profile) : []), [cities, profile])
  const focusAreas = useMemo(() => getFocusAreas(profile?.personalYear ?? 1), [profile?.personalYear])

  const coreNumbers = useMemo(() => {
    if (!profile) return []

    return [
      {
        label: 'How you naturally operate',
        numerologyLabel: 'Life Path',
        value: profile.lifePathNumber,
        detail: profile.insights.lifePathMeaning,
      },
      {
        label: 'What others notice first',
        numerologyLabel: 'Birthday',
        value: profile.insights.birthdayNumber,
        detail: profile.insights.birthdayMeaning,
      },
      {
        label: 'Your first response style',
        numerologyLabel: 'Attitude',
        value: profile.insights.attitudeNumber,
        detail: profile.insights.attitudeMeaning,
      },
    ]
  }, [profile])

  const timingSnapshot = useMemo(() => {
    if (!profile) return []

    return [
      {
        label: 'Theme of this month',
        numerologyLabel: 'Personal Month',
        value: profile.insights.personalMonth,
        detail: profile.insights.personalMonthMeaning,
      },
      {
        label: 'Theme of next year',
        numerologyLabel: 'Next Year',
        value: profile.insights.nextPersonalYear,
        detail: `${profile.insights.nextLifeStage}. ${profile.insights.nextLifeStageDescription}`,
      },
    ]
  }, [profile])

  const yearlyBest = useMemo(() => {
    return [...ranked]
      .sort((a, b) => b.goalAlignment - a.goalAlignment || b.score - a.score)
      .filter((item) => item.goalAlignment > 0 || item.matchingInfluences.length > 0)
      .slice(0, 6)
  }, [ranked])

  const overallBest = useMemo(
    () => [...ranked].sort((a, b) => b.energyAlignment - a.energyAlignment || b.score - a.score).slice(0, 6),
    [ranked],
  )

  const visibleCountries = useMemo(
    () => Array.from(new Set([...yearlyBest, ...overallBest].map((item) => item.city.country))),
    [overallBest, yearlyBest],
  )

  useEffect(() => {
    const missingCountries = visibleCountries.filter(
      (country) => !Object.prototype.hasOwnProperty.call(advisoryLevelsByCountry, country),
    )
    if (missingCountries.length === 0) return

    let cancelled = false

    void Promise.all(
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
        const next = { ...current }
        for (const entry of entries) {
          next[entry.country] = entry.level
        }
        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [advisoryLevelsByCountry, visibleCountries])

  if (!profile || !needs) return null

  return (
    <Drawer
      title={tab === 'locations' ? 'Best-fit places' : 'Your cycle'}
      subtitle={`Year ${profile.personalYear}`}
      onClose={onClose}
      width={width}
      height={height}
      top={top}
      variant="left"
    >
      <View style={styles.segmentedControl}>
        <Pressable onPress={() => setTab('locations')} style={[styles.segment, tab === 'locations' ? styles.segmentActive : null]}>
          <Text style={[styles.segmentText, tab === 'locations' ? styles.segmentTextActive : null]}>Locations</Text>
        </Pressable>
        <Pressable onPress={() => setTab('about')} style={[styles.segment, tab === 'about' ? styles.segmentActive : null]}>
          <Text style={[styles.segmentText, tab === 'about' ? styles.segmentTextActive : null]}>About</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
        {tab === 'locations' ? (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Why these places lead</Text>
              <Text style={styles.infoBody}>
                Year {profile.personalYear} ({profile.lifeStage}): {needs.description}
              </Text>
            </View>

            <View style={styles.listSection}>
              <Text style={styles.sectionTitleSmall}>Best for this year</Text>
              <Text style={styles.sectionCopySmall}>The clearest matches for your current cycle and line pattern.</Text>
              {yearlyBest.map(({ city, reason, goalAlignment, energyAlignment, matchingInfluences }) => {
                const key = cityKey(city)
                const advisoryLevel = advisoryLevelsByCountry[city.country]
                const isHighlighted = highlightedCity === key

                return (
                  <Pressable
                    key={`yearly-${key}`}
                    onPress={() => onCityPress(city)}
                    onPressIn={() => setHighlightedCity(key)}
                    onPressOut={() => setHighlightedCity(null)}
                    style={[styles.cityCard, isHighlighted ? styles.cityCardHighlighted : null]}
                  >
                    <Text style={styles.cityCardTitle}>{city.name}</Text>
                    <Text style={styles.cityCardSubtitle}>{city.country}</Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.badgeAccent}>
                        <Text style={styles.badgeAccentText}>Yearly {Math.round(goalAlignment * 100)}%</Text>
                      </View>
                      <View style={styles.badgeNeutral}>
                        <Text style={styles.badgeNeutralText}>Energy {Math.round(energyAlignment * 100)}%</Text>
                      </View>
                      {advisoryLevel ? (
                        <View style={[styles.badgeNeutral, { backgroundColor: ADVISORY_STYLES[advisoryLevel].panel }]}>
                          <Text style={[styles.badgeNeutralText, { color: ADVISORY_STYLES[advisoryLevel].badgeText }]}>
                            Level {advisoryLevel}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {matchingInfluences.length > 0 ? (
                      <View style={styles.badgeRow}>
                        {matchingInfluences.slice(0, 2).map((influence) => (
                          <View
                            key={`${key}-${influence.planet}-${influence.lineType}`}
                            style={[styles.influenceBadge, { backgroundColor: `${PLANET_COLORS[influence.planet]}18` }]}
                          >
                            <Text style={[styles.influenceBadgeText, { color: PLANET_COLORS[influence.planet] }]}>
                              {influence.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Text style={styles.cityCardBody}>{reason}</Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={styles.listSection}>
              <Text style={styles.sectionTitleSmall}>Highest alignment overall</Text>
              <Text style={styles.sectionCopySmall}>Strongest places on the map regardless of your current year.</Text>
              {overallBest.map(({ city, reason, energyAlignment, goalAlignment }) => {
                const key = cityKey(city)
                const advisoryLevel = advisoryLevelsByCountry[city.country]
                const isHighlighted = highlightedCity === key

                return (
                  <Pressable
                    key={`overall-${key}`}
                    onPress={() => onCityPress(city)}
                    onPressIn={() => setHighlightedCity(key)}
                    onPressOut={() => setHighlightedCity(null)}
                    style={[styles.cityCard, isHighlighted ? styles.cityCardHighlighted : null]}
                  >
                    <Text style={styles.cityCardTitle}>{city.name}</Text>
                    <Text style={styles.cityCardSubtitle}>{city.country}</Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.badgeSuccess}>
                        <Text style={styles.badgeSuccessText}>Energy {Math.round(energyAlignment * 100)}%</Text>
                      </View>
                      {goalAlignment > 0 ? (
                        <View style={styles.badgeAccent}>
                          <Text style={styles.badgeAccentText}>Yearly {Math.round(goalAlignment * 100)}%</Text>
                        </View>
                      ) : null}
                      {advisoryLevel ? (
                        <View style={[styles.badgeNeutral, { backgroundColor: ADVISORY_STYLES[advisoryLevel].panel }]}>
                          <Text style={[styles.badgeNeutralText, { color: ADVISORY_STYLES[advisoryLevel].badgeText }]}>
                            Level {advisoryLevel}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.cityCardBody}>{reason}</Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{profile.lifeStage}</Text>
              <Text style={styles.infoBody}>{getCycleYearLabel(profile.personalYear)}. {profile.lifeStageDescription}</Text>
              <Text style={styles.infoFootnote}>{INSIGHT_METHOD}</Text>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitleSmall}>Focus right now</Text>
              {focusAreas.map((focus) => (
                <View key={focus} style={styles.focusRow}>
                  <View style={styles.focusDot} />
                  <Text style={styles.focusText}>{focus}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitleSmall}>Core numbers</Text>
              {coreNumbers.map((item) => (
                <View key={item.label} style={styles.numberCard}>
                  <View style={styles.numberHeader}>
                    <Text style={styles.numberLabel}>{item.numerologyLabel}</Text>
                    <Text style={styles.numberValue}>No. {item.value}</Text>
                  </View>
                  <Text style={styles.numberTitle}>{item.label}</Text>
                  <Text style={styles.numberBody}>{item.detail}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitleSmall}>Timing snapshot</Text>
              {timingSnapshot.map((item) => (
                <View key={item.label} style={styles.numberCard}>
                  <View style={styles.numberHeader}>
                    <Text style={styles.numberLabel}>{item.numerologyLabel}</Text>
                    <Text style={styles.numberValue}>No. {item.value}</Text>
                  </View>
                  <Text style={styles.numberTitle}>{item.label}</Text>
                  <Text style={styles.numberBody}>{item.detail}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Drawer>
  )
}

function CityDrawer({
  width,
  height,
  top,
  alignRight,
  city,
  onClose,
}: {
  width: number
  height: number
  top: number
  alignRight: boolean
  city: CityWithEnergy
  onClose: () => void
}) {
  const cities = useStore((state) => state.cities)
  const { summary, loading: wikiLoading } = useWikiSummary(city)
  const advisoryState = useTravelAdvisory(city.country)
  const advisory = advisoryState?.status === 'ok' ? advisoryState.advisory : null

  const uniqueLines = useMemo(() => {
    const seen = new Set<string>()
    return city.activeLines.filter((line) => {
      const key = `${line.planet}-${line.lineType}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [city.activeLines])

  const maxEnergy = useMemo(() => cities.reduce((max, entry) => Math.max(max, entry.energyScore), 0), [cities])
  const energyPercent = useMemo(() => {
    if (maxEnergy <= 0) return 0
    return Math.round((city.energyScore / maxEnergy) * 100)
  }, [city.energyScore, maxEnergy])

  return (
    <Drawer
      title={city.name}
      subtitle={city.country}
      onClose={onClose}
      width={width}
      height={height}
      top={top}
      variant={alignRight ? 'right' : 'sheet'}
    >
      <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.alignmentGlass}>
          <View style={styles.alignmentRow}>
            <Text style={styles.alignmentLabel}>Alignment</Text>
            <Text style={styles.alignmentValue}>{energyPercent}%</Text>
          </View>
          <View style={styles.alignmentTrack}>
            <View style={[styles.alignmentFill, { width: `${energyPercent}%` }]} />
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitleSmall}>City information</Text>
          <Text style={styles.sectionCopySmall}>
            {wikiLoading
              ? 'Loading city context...'
              : (summary ?? `${city.name} offers a compelling blend of atmosphere, pace, and cultural texture for an intentional stay.`)}
          </Text>
        </View>

        {advisory || advisoryState?.status === 'unavailable' ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitleSmall}>Travel advisory</Text>
            {advisory ? (
              <View style={[styles.advisoryPanel, { backgroundColor: ADVISORY_STYLES[advisory.adviceLevel].panel }]}>
                <View style={styles.advisoryHeader}>
                  <Text style={styles.advisoryCountry}>{advisory.matchedCountry}</Text>
                  <View style={[styles.advisoryBadge, { backgroundColor: ADVISORY_STYLES[advisory.adviceLevel].badgeBg }]}>
                    <Text style={[styles.advisoryBadgeText, { color: ADVISORY_STYLES[advisory.adviceLevel].badgeText }]}>
                      Level {advisory.adviceLevel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.advisoryLabel}>{advisory.adviceLabel}</Text>
                <Text style={styles.sectionCopySmall}>{advisory.summary}</Text>
                <Text style={styles.footnote}>Updated {formatAdvisoryDate(advisory.updatedAt)}</Text>
              </View>
            ) : (
              <Text style={styles.sectionCopySmall}>The advisory feed is temporarily unavailable for this destination.</Text>
            )}
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitleSmall}>Planetary influences</Text>
          {uniqueLines.map((line) => (
            <View key={`${line.planet}-${line.lineType}`} style={styles.influenceCardLarge}>
              <View style={styles.influenceHeader}>
                <View style={[styles.influenceDotLarge, { backgroundColor: PLANET_COLORS[line.planet] }]} />
                <Text style={styles.influenceTitle}>
                  {line.planet} on {LINE_LABELS[line.lineType]}
                </Text>
              </View>
              <Text style={styles.sectionCopySmall}>{getInterpretation(line.planet, line.lineType)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitleSmall}>Suggested experiences</Text>
          {SUGGESTED_EXPERIENCES.map((item) => (
            <View key={item.title} style={styles.experienceCard}>
              <View style={styles.experienceTag}>
                <Text style={styles.experienceTagText}>{item.tag}</Text>
              </View>
              <Text style={styles.experienceTitle}>{item.title}</Text>
              <Text style={styles.sectionCopySmall}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Drawer>
  )
}

export function DashboardScreen() {
  const profile = useStore((state) => state.profile)
  const selectedCity = useStore((state) => state.selectedCity)
  const activeUtilityPanel = useStore((state) => state.activeUtilityPanel)
  const setActiveUtilityPanel = useStore((state) => state.setActiveUtilityPanel)
  const setSelectedCity = useStore((state) => state.setSelectedCity)
  const setView = useStore((state) => state.setView)
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()

  const isLargeScreen = width >= 960
  const utilityDrawerWidth = Math.min(width - 24, isLargeScreen ? 420 : Math.max(width - 24, 320))
  const utilityDrawerHeight = Math.max(420, height - insets.top - insets.bottom - 24)
  const utilityDrawerTop = insets.top + 12
  const cityDrawerWidth = isLargeScreen ? Math.min(460, width * 0.42) : width - 24
  const cityDrawerHeight = isLargeScreen
    ? Math.max(460, height - insets.top - insets.bottom - 24)
    : Math.min(height * 0.82, 760)
  const cityDrawerTop = isLargeScreen ? insets.top + 12 : 0
  const showInsightsTrigger = !(selectedCity && !isLargeScreen)

  if (!profile) return null

  const openCity = (city: CityWithEnergy) => {
    setActiveUtilityPanel(null)
    setSelectedCity(city)
    setView('detail')
  }

  const closeCity = () => {
    setSelectedCity(null)
    setView('globe')
  }

  const toggleUtilityPanel = (panel: UtilityPanelState) => {
    setActiveUtilityPanel(activeUtilityPanel === panel ? null : panel)
  }

  return (
    <View style={styles.screen}>
      <WorldMapCard onCityPress={openCity} />

      {activeUtilityPanel ? (
        <Pressable style={styles.backdrop} onPress={() => setActiveUtilityPanel(null)} />
      ) : null}

      <View style={[styles.topLeftRail, { top: insets.top + 12 }]}>
        <FloatingButton
          active={activeUtilityPanel === 'settings'}
          onPress={() => toggleUtilityPanel('settings')}
        />
        {showInsightsTrigger ? (
          <InsightsTrigger
            lifeStage={profile.lifeStage}
            onPress={() => toggleUtilityPanel('insights')}
          />
        ) : null}
      </View>

      {activeUtilityPanel === 'settings' ? (
        <SettingsDrawer
          width={utilityDrawerWidth}
          height={utilityDrawerHeight}
          top={utilityDrawerTop}
          onClose={() => setActiveUtilityPanel(null)}
        />
      ) : null}

      {activeUtilityPanel === 'insights' ? (
        <InsightsDrawer
          width={utilityDrawerWidth}
          height={utilityDrawerHeight}
          top={utilityDrawerTop}
          onClose={() => setActiveUtilityPanel(null)}
          onCityPress={openCity}
        />
      ) : null}

      {selectedCity ? (
        <CityDrawer
          width={cityDrawerWidth}
          height={cityDrawerHeight}
          top={cityDrawerTop}
          alignRight={isLargeScreen}
          city={selectedCity}
          onClose={closeCity}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#DCE8F4',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 18, 32, 0.22)',
  },
  topControls: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topLeftRail: {
    position: 'absolute',
    left: 12,
    zIndex: 20,
    gap: 12,
  },
  floatingButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(211, 215, 223, 0.96)',
    boxShadow: shadows.control,
  },
  floatingButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  floatingButtonIcon: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '800',
    color: colors.muted,
  },
  floatingButtonIconActive: {
    color: '#FFFFFF',
  },
  floatingButtonLabel: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    display: 'none',
  },
  floatingButtonLabelActive: {
    color: '#FFFFFF',
  },
  insightsTrigger: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(211, 215, 223, 0.96)',
    boxShadow: shadows.control,
  },
  insightsTriggerIcon: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  drawer: {
    position: 'absolute',
    zIndex: 30,
    borderRadius: 28,
    paddingTop: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(221, 225, 232, 0.98)',
    boxShadow: shadows.panel,
    overflow: 'hidden',
  },
  drawerLeft: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
  },
  drawerSheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(227, 230, 235, 0.92)',
  },
  drawerHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  drawerEyebrow: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  drawerTitle: {
    fontFamily: fonts.serif,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  closeButtonText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  drawerScrollContent: {
    padding: 18,
    gap: 14,
  },
  sectionBlock: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.text,
  },
  resultsList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  resultItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(227, 230, 235, 0.92)',
  },
  resultText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
  },
  primaryAction: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    boxShadow: shadows.accent,
  },
  primaryActionDisabled: {
    opacity: 0.55,
  },
  primaryActionText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionTitleSmall: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  sectionCopySmall: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
  },
  legendGroup: {
    gap: 8,
  },
  legendHeading: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceSoft,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  legendText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.text,
  },
  lineStyleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: colors.surfaceSoft,
  },
  lineStyleCopy: {
    flex: 1,
    gap: 2,
  },
  lineStyleLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  lineStyleContext: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
  },
  linePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linePreviewSolid: {
    width: 56,
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: '#4B5563',
  },
  linePreviewDashLong: {
    width: 14,
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: '#4B5563',
  },
  linePreviewGap: {
    width: 4,
    height: 2,
  },
  linePreviewDot: {
    width: 3,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: '#4B5563',
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  segmentActive: {
    backgroundColor: colors.text,
  },
  segmentText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  infoCard: {
    gap: 8,
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.surfaceSoft,
  },
  infoTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  infoBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  infoFootnote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  listSection: {
    gap: 10,
  },
  cityCard: {
    gap: 8,
    borderRadius: 22,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(221, 225, 232, 0.98)',
  },
  cityCardHighlighted: {
    borderColor: 'rgba(255, 56, 92, 0.4)',
    backgroundColor: '#FFF7F9',
  },
  cityCardTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
  },
  cityCardSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeAccent: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.accentSoft,
  },
  badgeAccentText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accentStrong,
  },
  badgeNeutral: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceSoft,
  },
  badgeNeutralText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  badgeSuccess: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ECFDF3',
  },
  badgeSuccessText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: colors.success,
  },
  influenceBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  influenceBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  cityCardBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  focusDot: {
    width: 8,
    height: 8,
    marginTop: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  focusText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  numberCard: {
    gap: 6,
    borderRadius: 18,
    padding: 14,
    backgroundColor: colors.surfaceSoft,
  },
  numberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  numberLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  numberValue: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  numberTitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  numberBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },
  alignmentGlass: {
    gap: 8,
    marginBottom: 6,
  },
  alignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  alignmentLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  alignmentValue: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  alignmentTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  alignmentFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  advisoryPanel: {
    gap: 8,
    borderRadius: 18,
    padding: 14,
  },
  advisoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  advisoryCountry: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  advisoryBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  advisoryBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
  },
  advisoryLabel: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  footnote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
  },
  influenceCardLarge: {
    gap: 8,
    borderRadius: 18,
    padding: 14,
    backgroundColor: colors.surfaceSoft,
  },
  influenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  influenceDotLarge: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  influenceTitle: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  experienceCard: {
    gap: 8,
    borderRadius: 18,
    padding: 14,
    backgroundColor: colors.surfaceSoft,
  },
  experienceTag: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.accentSoft,
  },
  experienceTagText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accentStrong,
  },
  experienceTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
  },
})
