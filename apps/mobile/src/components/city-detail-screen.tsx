import { useEffect, useMemo, useState } from 'react'
import { Link } from 'expo-router'
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'

import { MobileScrollScreen } from '@/src/components/mobile-scroll-screen'
import { fetchTravelAdvisory, type TravelAdvisoryLookup } from '@/src/lib/travelAdvisory'
import { getInterpretation } from '@/src/lib/interpretations'
import {
  fetchCityActivities,
  rankActivitiesForCity,
  type CityActivitiesLookup,
} from '@/src/lib/viator'
import { fetchCityWikiSummary } from '@/src/lib/wiki'
import { useStore } from '@/src/store/useStore'
import type { CityWithEnergy, LineType, Planet } from '@/src/types'
import { colors, fonts, radii, shadows } from '@/src/theme'

const PLANET_COLORS: Record<Planet, string> = {
  Sun: '#F9A825',
  Moon: '#78909C',
  Mercury: '#00ACC1',
  Venus: '#E84393',
  Mars: '#E53935',
  Jupiter: '#6C5CE7',
  Saturn: '#A67C52',
  Uranus: '#42A5F5',
  Neptune: '#7E57C2',
  Pluto: '#455A64',
}

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

  return error.name === 'AbortError' || /aborted/i.test(error.message)
}

export function CityDetailScreen({
  city,
  isHydrating = false,
}: {
  city: CityWithEnergy | null
  isHydrating?: boolean
}) {
  const [wikiSummary, setWikiSummary] = useState<string | null>(null)
  const [wikiLoading, setWikiLoading] = useState(false)
  const [advisoryState, setAdvisoryState] = useState<TravelAdvisoryLookup | null>(null)
  const [activitiesState, setActivitiesState] = useState<CityActivitiesLookup | null>(null)
  const cities = useStore((state) => state.cities)
  const { width } = useWindowDimensions()
  const isCompact = width < 420

  useEffect(() => {
    if (!city) return

    let cancelled = false
    const controller = new AbortController()

    setWikiLoading(true)
    void fetchCityWikiSummary(city.name, city.country, city.lat, city.lng, controller.signal)
      .then((result) => {
        if (!cancelled) setWikiSummary(result?.summary ?? null)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        console.error('Failed to load city summary', error)
        if (!cancelled) setWikiSummary(null)
      })
      .finally(() => {
        if (!cancelled) setWikiLoading(false)
      })

    void fetchTravelAdvisory(city.country, controller.signal)
      .then((result) => {
        if (!cancelled) setAdvisoryState(result)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        console.error('Failed to load travel advisory', error)
        if (!cancelled) setAdvisoryState({ status: 'unavailable' })
      })

    setActivitiesState(null)
    void fetchCityActivities(city.name, city.country, controller.signal)
      .then((result) => {
        if (!cancelled) setActivitiesState(result)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        console.error('Failed to load city activities', error)
        if (!cancelled) setActivitiesState({ status: 'unavailable' })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [city])

  const uniqueLines = useMemo(() => {
    const seen = new Set<string>()
    return (city?.activeLines ?? []).filter((line) => {
      const key = `${line.planet}-${line.lineType}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [city])

  const advisory = advisoryState?.status === 'ok' ? advisoryState.advisory : null
  const maxEnergy = useMemo(() => cities.reduce((max, entry) => Math.max(max, entry.energyScore), 0), [cities])
  const energyPercent = useMemo(() => {
    if (!city || maxEnergy <= 0) return 0
    return Math.round((city.energyScore / maxEnergy) * 100)
  }, [city, maxEnergy])
  const rankedActivities = useMemo(() => {
    if (!city || activitiesState?.status !== 'ok') return []
    return rankActivitiesForCity(city, activitiesState.data.activities)
  }, [activitiesState, city])

  if (isHydrating) {
    return (
      <MobileScrollScreen contentContainerStyle={styles.content}>
        <View style={styles.stack}>
          <View style={styles.card}>
            <Text style={styles.title}>Loading city details</Text>
            <Text style={styles.body}>Restoring your saved map data for this route.</Text>
          </View>
        </View>
      </MobileScrollScreen>
    )
  }

  if (!city) {
    return (
      <MobileScrollScreen contentContainerStyle={styles.content}>
        <View style={styles.stack}>
          <View style={styles.card}>
            <Text style={styles.title}>City not found</Text>
            <Text style={styles.body}>This detail route needs an active city from the in-app recommendations.</Text>
            <Link href="/" asChild>
              <Pressable
                accessibilityHint="Returns to the map screen."
                accessibilityLabel="Back to map"
                accessibilityRole="button"
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>Back to map</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </MobileScrollScreen>
    )
  }

  return (
    <MobileScrollScreen contentContainerStyle={styles.content}>
      <View style={styles.stack}>
        <View style={styles.hero}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {uniqueLines.length} {uniqueLines.length === 1 ? 'influence' : 'influences'}
              </Text>
            </View>
          </View>

          <Text style={[styles.cityName, isCompact ? styles.cityNameCompact : null]}>{city.name}</Text>
          <Text style={styles.cityCountry}>{city.country}</Text>

          <View style={[styles.quickFactsRow, isCompact ? styles.quickFactsColumn : null]}>
            <View style={styles.quickFact}>
              <Text style={styles.quickFactLabel}>Country</Text>
              <Text style={styles.quickFactValue}>{city.country}</Text>
            </View>
            <View style={styles.quickFact}>
              <Text style={styles.quickFactLabel}>Energy</Text>
              <Text style={styles.quickFactValue}>{Math.round(city.energyScore * 100)}%</Text>
            </View>
            <View style={styles.quickFact}>
              <Text style={styles.quickFactLabel}>Influences</Text>
              <Text style={styles.quickFactValue}>{uniqueLines.length}</Text>
            </View>
          </View>

          <View style={styles.alignmentBox}>
            <View style={styles.alignmentRow}>
              <Text style={styles.alignmentLabel}>Alignment</Text>
              <Text style={styles.alignmentValue}>{energyPercent}%</Text>
            </View>
            <View style={styles.alignmentTrack}>
              <View style={[styles.alignmentFill, { width: `${energyPercent}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>Context</Text>
          <Text style={styles.sectionTitle}>Local vibe preview</Text>
          <Text style={styles.body}>
            {wikiLoading
              ? 'Loading city context...'
              : (wikiSummary ?? `${city.name} offers a compelling blend of atmosphere, pace, and cultural texture for an intentional stay.`)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>Experiences</Text>
          <Text style={styles.sectionTitle}>Things to do here</Text>
          {activitiesState === null ? (
            <Text style={styles.body}>Loading live Viator activities for this city...</Text>
          ) : null}
          {activitiesState?.status === 'ok' && rankedActivities.length > 0 ? (
            <View style={styles.activitiesList}>
              {rankedActivities.map((activity) => (
                <View key={activity.providerId} style={styles.activityCard}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                  </View>

                  <View style={styles.activityMetaRow}>
                    {activity.priceLabel ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>{activity.priceLabel}</Text>
                      </View>
                    ) : null}
                    {activity.durationLabel ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>{activity.durationLabel}</Text>
                      </View>
                    ) : null}
                    {activity.rating !== null ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>
                          {activity.rating.toFixed(1)}{activity.reviewCount ? ` (${activity.reviewCount})` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {activity.description ? (
                    <Text style={styles.body}>{activity.description}</Text>
                  ) : null}
                  <Text style={styles.activityReason}>{activity.reason}</Text>

                  {activity.url ? (
                    <Pressable onPress={() => void Linking.openURL(activity.url as string)} style={styles.activityButton}>
                      <Text style={styles.activityButtonText}>View on Viator</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          {activitiesState?.status === 'ok' && rankedActivities.length === 0 ? (
            <Text style={styles.body}>No live Viator activities were returned for this city yet.</Text>
          ) : null}
          {activitiesState?.status === 'not_found' ? (
            <Text style={styles.body}>No live Viator activities were found for this city.</Text>
          ) : null}
          {activitiesState?.status === 'not_configured' ? (
            <Text style={styles.body}>Live activities will appear here once the Viator feed is connected.</Text>
          ) : null}
          {activitiesState?.status === 'unavailable' ? (
            <Text style={styles.body}>Live activities are temporarily unavailable for this destination.</Text>
          ) : null}
        </View>

        {(advisory || advisoryState?.status === 'unavailable') && (
          <View style={styles.card}>
            <Text style={styles.sectionEyebrow}>Safety</Text>
            <Text style={styles.sectionTitle}>Travel advisory</Text>
            {advisory ? (
              <View
                style={[
                  styles.advisoryPanel,
                  { backgroundColor: ADVISORY_STYLES[advisory.adviceLevel].panel },
                ]}
              >
                <View style={styles.advisoryHeader}>
                  <Text style={styles.advisoryCountry}>{advisory.matchedCountry}</Text>
                  <View
                    style={[
                      styles.advisoryBadge,
                      { backgroundColor: ADVISORY_STYLES[advisory.adviceLevel].badgeBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.advisoryBadgeText,
                        { color: ADVISORY_STYLES[advisory.adviceLevel].badgeText },
                      ]}
                    >
                      Level {advisory.adviceLevel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.advisoryLabel}>{advisory.adviceLabel}</Text>
                <Text style={styles.body}>{advisory.summary}</Text>
                <Text style={styles.metaText}>Updated {formatAdvisoryDate(advisory.updatedAt)}</Text>
              </View>
            ) : (
              <Text style={styles.body}>The advisory feed is temporarily unavailable for this destination.</Text>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>Interpretation</Text>
          <Text style={styles.sectionTitle}>Planetary influences</Text>
          {uniqueLines.map((line) => (
            <View key={`${line.planet}-${line.lineType}`} style={styles.influenceCard}>
              <View style={styles.influenceHeader}>
                <View style={[styles.influenceDot, { backgroundColor: PLANET_COLORS[line.planet] }]} />
                <Text style={styles.influenceTitle}>{line.planet} on {LINE_LABELS[line.lineType]}</Text>
              </View>
              <Text style={styles.body}>{getInterpretation(line.planet, line.lineType)}</Text>
            </View>
          ))}
        </View>
      </View>
    </MobileScrollScreen>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
  },
  stack: {
    width: '100%',
    maxWidth: 980,
    gap: 16,
  },
  hero: {
    gap: 14,
    borderRadius: radii.lg,
    padding: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(221, 225, 232, 0.98)',
    boxShadow: shadows.panel,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  heroBadge: {
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentStrong,
  },
  cityName: {
    fontFamily: fonts.serif,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700',
    color: colors.text,
  },
  cityNameCompact: {
    fontSize: 34,
    lineHeight: 40,
  },
  cityCountry: {
    fontFamily: fonts.sans,
    fontSize: 17,
    color: colors.muted,
  },
  quickFactsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickFactsColumn: {
    flexDirection: 'column',
  },
  quickFact: {
    flex: 1,
    gap: 6,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceSoft,
  },
  quickFactLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  quickFactValue: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  alignmentBox: {
    gap: 8,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  alignmentValue: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  alignmentTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
  },
  alignmentFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  card: {
    gap: 12,
    borderRadius: radii.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(221, 225, 232, 0.98)',
    backgroundColor: colors.surface,
    boxShadow: shadows.panel,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.text,
  },
  sectionEyebrow: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.text,
  },
  advisoryPanel: {
    gap: 10,
    borderRadius: 18,
    padding: 16,
  },
  advisoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.muted,
  },
  metaText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
  },
  influenceCard: {
    gap: 8,
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.surfaceSoft,
  },
  influenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  influenceDot: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  influenceTitle: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  activitiesList: {
    gap: 12,
  },
  activityCard: {
    gap: 10,
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.surfaceSoft,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activityTitle: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.text,
  },
  activityMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaPillText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  activityReason: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.text,
  },
  activityButton: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.accent,
    boxShadow: shadows.accent,
  },
  activityButtonText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.accent,
    boxShadow: shadows.accent,
  },
  backButtonText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
})
