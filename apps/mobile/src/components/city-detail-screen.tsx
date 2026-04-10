import { useEffect, useMemo, useState } from 'react'
import { Link } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { fetchTravelAdvisory, type TravelAdvisoryLookup } from '@/src/lib/travelAdvisory'
import { getInterpretation } from '@/src/lib/interpretations'
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

function formatAdvisoryDate(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Date unavailable'

  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))
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
  const cities = useStore((state) => state.cities)

  useEffect(() => {
    if (!city) return

    let cancelled = false
    const controller = new AbortController()

    setWikiLoading(true)
    void fetchCityWikiSummary(city.name, city.country, city.lat, city.lng, controller.signal)
      .then((result) => {
        if (!cancelled) setWikiSummary(result?.summary ?? null)
      })
      .finally(() => {
        if (!cancelled) setWikiLoading(false)
      })

    void fetchTravelAdvisory(city.country, controller.signal).then((result) => {
      if (!cancelled) setAdvisoryState(result)
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

  if (isHydrating) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.stack}>
          <View style={styles.card}>
            <Text style={styles.title}>Loading city details</Text>
            <Text style={styles.body}>Restoring your saved map data for this route.</Text>
          </View>
        </View>
      </ScrollView>
    )
  }

  if (!city) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.stack}>
          <View style={styles.card}>
            <Text style={styles.title}>City not found</Text>
            <Text style={styles.body}>This detail route needs an active city from the in-app recommendations.</Text>
            <Link href="/" asChild>
              <Pressable style={styles.backButton}>
                <Text style={styles.backButtonText}>Back to map</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.stack}>
        <View style={styles.hero}>
          <Link href="/" asChild>
            <Pressable style={styles.backButtonGhost}>
              <Text style={styles.backButtonGhostText}>Back to map</Text>
            </Pressable>
          </Link>

          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {uniqueLines.length} {uniqueLines.length === 1 ? 'influence' : 'influences'}
              </Text>
            </View>
          </View>

          <Text style={styles.cityName}>{city.name}</Text>
          <Text style={styles.cityCountry}>{city.country}</Text>

          <View style={styles.quickFactsRow}>
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

        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>Stay ideas</Text>
          <Text style={styles.sectionTitle}>Suggested experiences</Text>
          {SUGGESTED_EXPERIENCES.map((item) => (
            <View key={item.title} style={styles.experienceCard}>
              <View style={styles.experienceTag}>
                <Text style={styles.experienceTagText}>{item.tag}</Text>
              </View>
              <Text style={styles.experienceTitle}>{item.title}</Text>
              <Text style={styles.body}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: colors.bg,
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
  cityCountry: {
    fontFamily: fonts.sans,
    fontSize: 17,
    color: colors.muted,
  },
  quickFactsRow: {
    flexDirection: 'row',
    gap: 10,
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
  experienceCard: {
    gap: 6,
    borderRadius: 18,
    padding: 16,
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
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.text,
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
  backButtonGhost: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.control,
  },
  backButtonGhostText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
})
