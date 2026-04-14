import type { CityWithEnergy, LineType, Planet } from '@/src/types'

const DEFAULT_TRAVEL_API_BASE = 'https://vibe-travel-advisory-api.mitchellrbenjamin.workers.dev'
const ENDPOINT_PATH = '/api/v1/city-activities'
const SUCCESS_CACHE_TTL_MS = 15 * 60 * 1000
const ERROR_CACHE_TTL_MS = 60 * 1000
const CACHE_VERSION = 'v2'

type ActivityTheme =
  | 'adventure'
  | 'art'
  | 'food'
  | 'iconic'
  | 'luxury'
  | 'nature'
  | 'nightlife'
  | 'romance'
  | 'spirituality'
  | 'wellness'
  | 'learning'
  | 'community'

interface ThemeDefinition {
  label: string
  keywords: string[]
}

export interface CityActivity {
  provider: 'viator'
  providerId: string
  title: string
  description: string
  imageUrl: string | null
  priceLabel: string | null
  priceAmount: number | null
  rating: number | null
  reviewCount: number | null
  durationMinutes: number | null
  durationLabel: string | null
  url: string | null
  flags: string[]
  destinations: string[]
}

export interface RankedCityActivity extends CityActivity {
  matchScore: number
  matchedThemes: string[]
  reason: string
}

interface CityActivitiesResponse {
  provider: 'viator'
  city: string
  country: string
  searchTerm: string
  fetchedAt: string
  totalCount: number | null
  activities: CityActivity[]
}

export type CityActivitiesLookup =
  | { status: 'ok', data: CityActivitiesResponse }
  | { status: 'not_configured' }
  | { status: 'not_found' }
  | { status: 'unavailable' }

const cache = new Map<string, { expiresAt: number, data: CityActivitiesLookup }>()

const LINE_LABELS: Record<LineType, string> = {
  MC: 'Midheaven',
  IC: 'Imum Coeli',
  ASC: 'Ascendant',
  DSC: 'Descendant',
}

const THEME_DEFINITIONS: Record<ActivityTheme, ThemeDefinition> = {
  adventure: {
    label: 'Adventure',
    keywords: ['adventure', 'bike', 'climb', 'hike', 'kayak', 'rafting', 'snorkel', 'surf', 'trek', 'zipline'],
  },
  art: {
    label: 'Art & design',
    keywords: ['art', 'gallery', 'museum', 'photography', 'street art', 'design', 'fashion', 'craft'],
  },
  food: {
    label: 'Food & taste',
    keywords: ['cooking', 'food', 'market', 'tasting', 'wine', 'chocolate', 'cheese', 'dinner', 'brunch', 'mezcal'],
  },
  iconic: {
    label: 'Iconic highlights',
    keywords: ['best of', 'classic', 'city tour', 'highlights', 'landmarks', 'must-see', 'panoramic', 'signature'],
  },
  luxury: {
    label: 'Luxury',
    keywords: ['champagne', 'exclusive', 'luxury', 'premium', 'private', 'vip', 'yacht'],
  },
  nature: {
    label: 'Nature',
    keywords: ['beach', 'boat', 'cave', 'coast', 'forest', 'garden', 'island', 'mountain', 'park', 'waterfall'],
  },
  nightlife: {
    label: 'Night energy',
    keywords: ['bar', 'boat party', 'cocktail', 'night', 'party', 'pub', 'sunset', 'thames rockets'],
  },
  romance: {
    label: 'Romance',
    keywords: ['couples', 'cruise', 'date', 'romantic', 'sunset', 'wine', 'candle'],
  },
  spirituality: {
    label: 'Spiritual depth',
    keywords: ['ceremony', 'church', 'meditation', 'mindfulness', 'sacred', 'spiritual', 'temple'],
  },
  wellness: {
    label: 'Restoration',
    keywords: ['bath', 'healing', 'massage', 'spa', 'thermal', 'wellness', 'yoga'],
  },
  learning: {
    label: 'Learning',
    keywords: ['class', 'course', 'guided', 'history', 'lesson', 'masterclass', 'tour', 'walk', 'workshop'],
  },
  community: {
    label: 'Connection',
    keywords: ['family', 'group', 'local', 'neighborhood', 'social', 'community', 'shared'],
  },
}

const PLANET_THEME_WEIGHTS: Record<Planet, Array<[ActivityTheme, number]>> = {
  Sun: [['iconic', 1.2], ['luxury', 0.8], ['art', 0.6]],
  Moon: [['wellness', 1.2], ['community', 0.9], ['nature', 0.6]],
  Mercury: [['learning', 1.2], ['food', 0.8], ['community', 0.6]],
  Venus: [['romance', 1.2], ['art', 1.0], ['food', 0.9], ['luxury', 0.7]],
  Mars: [['adventure', 1.2], ['nightlife', 0.8], ['nature', 0.6]],
  Jupiter: [['learning', 1.0], ['adventure', 0.9], ['food', 0.8], ['iconic', 0.6]],
  Saturn: [['learning', 0.9], ['iconic', 0.7], ['wellness', 0.5]],
  Uranus: [['nightlife', 1.0], ['art', 0.8], ['adventure', 0.7]],
  Neptune: [['spirituality', 1.2], ['wellness', 1.0], ['art', 0.6]],
  Pluto: [['spirituality', 0.9], ['wellness', 0.7], ['nightlife', 0.5]],
}

const LINE_THEME_WEIGHTS: Record<LineType, Array<[ActivityTheme, number]>> = {
  MC: [['iconic', 0.5], ['luxury', 0.4], ['learning', 0.3]],
  IC: [['wellness', 0.5], ['spirituality', 0.4], ['food', 0.3]],
  ASC: [['adventure', 0.5], ['nature', 0.4], ['nightlife', 0.3]],
  DSC: [['romance', 0.5], ['community', 0.4], ['food', 0.3]],
}

function resolveTravelApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_TRAVEL_API_BASE?.replace(/\/+$/, '')
  if (configured) return configured

  return DEFAULT_TRAVEL_API_BASE
}

function activitiesUrl(city: string, country: string, limit: number): string {
  const params = new URLSearchParams({
    city,
    country,
    limit: String(limit),
    v: CACHE_VERSION,
  })

  return `${resolveTravelApiBase()}${ENDPOINT_PATH}?${params.toString()}`
}

export async function fetchCityActivities(
  city: string,
  country: string,
  signal?: AbortSignal,
  limit = 8,
): Promise<CityActivitiesLookup> {
  const normalizedCity = city.trim()
  const normalizedCountry = country.trim()
  if (!normalizedCity || !normalizedCountry) return { status: 'not_found' }

  const cacheKey = `${CACHE_VERSION}|${normalizedCity.toLowerCase()}|${normalizedCountry.toLowerCase()}|${limit}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  try {
    const response = await fetch(activitiesUrl(normalizedCity, normalizedCountry, limit), { signal })
    const payload = await response.json().catch(() => null) as Partial<CityActivitiesResponse> & { code?: string } | null

    if (response.status === 404) {
      return cacheLookup(cacheKey, { status: 'not_found' })
    }

    if (response.status === 503 && payload?.code === 'not_configured') {
      return cacheLookup(cacheKey, { status: 'not_configured' }, true)
    }

    if (!response.ok || !isCityActivitiesResponse(payload)) {
      return cacheLookup(cacheKey, { status: 'unavailable' }, true)
    }

    return cacheLookup(cacheKey, { status: 'ok', data: payload })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    return cacheLookup(cacheKey, { status: 'unavailable' }, true)
  }
}

export function rankActivitiesForCity(
  city: CityWithEnergy,
  activities: CityActivity[],
  limit = 6,
): RankedCityActivity[] {
  const cityThemes = deriveCityThemeWeights(city)
  const cityThemeEntries = [...cityThemes.entries()].sort((a, b) => b[1] - a[1])

  return [...activities]
    .map((activity) => {
      const matched = detectActivityThemes(activity)
      const matchScore = matched.reduce(
        (sum, theme) => sum + (cityThemes.get(theme) ?? 0),
        0,
      )

      const matchedThemes = matched
        .sort((left, right) => (cityThemes.get(right) ?? 0) - (cityThemes.get(left) ?? 0))
        .slice(0, 3)

      return {
        ...activity,
        matchScore,
        matchedThemes: matchedThemes.map((theme) => THEME_DEFINITIONS[theme].label),
        reason: buildReason(city, matchedThemes, cityThemeEntries),
      }
    })
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore
      if ((right.rating ?? 0) !== (left.rating ?? 0)) return (right.rating ?? 0) - (left.rating ?? 0)
      return (right.reviewCount ?? 0) - (left.reviewCount ?? 0)
    })
    .slice(0, limit)
}

function deriveCityThemeWeights(city: CityWithEnergy): Map<ActivityTheme, number> {
  const weights = new Map<ActivityTheme, number>()
  const seen = new Set<string>()

  for (const line of city.activeLines) {
    const key = `${line.planet}-${line.lineType}`
    if (seen.has(key)) continue
    seen.add(key)

    for (const [theme, weight] of PLANET_THEME_WEIGHTS[line.planet]) {
      weights.set(theme, (weights.get(theme) ?? 0) + weight)
    }

    for (const [theme, weight] of LINE_THEME_WEIGHTS[line.lineType]) {
      weights.set(theme, (weights.get(theme) ?? 0) + weight)
    }
  }

  return weights
}

function detectActivityThemes(activity: CityActivity): ActivityTheme[] {
  const haystack = [
    activity.title,
    activity.description,
    activity.flags.join(' '),
    activity.destinations.join(' '),
  ]
    .join(' ')
    .toLowerCase()

  const matched = new Set<ActivityTheme>()
  for (const [theme, definition] of Object.entries(THEME_DEFINITIONS) as Array<[ActivityTheme, ThemeDefinition]>) {
    if (definition.keywords.some((keyword) => haystack.includes(keyword))) {
      matched.add(theme)
    }
  }

  if (matched.size === 0) {
    matched.add('iconic')
  }

  return [...matched]
}

function buildReason(
  city: CityWithEnergy,
  matchedThemes: ActivityTheme[],
  cityThemeEntries: Array<[ActivityTheme, number]>,
): string {
  if (matchedThemes.length > 0) {
    const labels = matchedThemes.map((theme) => THEME_DEFINITIONS[theme].label.toLowerCase())
    if (labels.length >= 2) {
      return `Strong fit for this city's ${labels[0]} and ${labels[1]} energy.`
    }
    return `Strong fit for this city's ${labels[0]} energy.`
  }

  const leadLine = uniqueLineLabels(city)[0]
  if (leadLine) {
    return `${leadLine} is the clearest influence here, so this is a solid live pick from Viator.`
  }

  const leadTheme = cityThemeEntries[0]?.[0]
  if (leadTheme) {
    return `Good match for the city's ${THEME_DEFINITIONS[leadTheme].label.toLowerCase()} tone.`
  }

  return `Popular live activity in ${city.name}.`
}

function uniqueLineLabels(city: CityWithEnergy): string[] {
  const labels: string[] = []
  const seen = new Set<string>()

  for (const line of city.activeLines) {
    const key = `${line.planet}-${line.lineType}`
    if (seen.has(key)) continue
    seen.add(key)
    labels.push(`${line.planet} on ${LINE_LABELS[line.lineType]}`)
  }

  return labels
}

function cacheLookup(
  cacheKey: string,
  result: CityActivitiesLookup,
  preferShortTtl = false,
): CityActivitiesLookup {
  cache.set(cacheKey, {
    expiresAt: Date.now() + (
      result.status === 'unavailable' || result.status === 'not_configured' || preferShortTtl
        ? ERROR_CACHE_TTL_MS
        : SUCCESS_CACHE_TTL_MS
    ),
    data: result,
  })

  return result
}

function isCityActivitiesResponse(payload: Partial<CityActivitiesResponse> | null): payload is CityActivitiesResponse {
  return (
    payload?.provider === 'viator'
    && typeof payload.city === 'string'
    && typeof payload.country === 'string'
    && typeof payload.searchTerm === 'string'
    && typeof payload.fetchedAt === 'string'
    && (typeof payload.totalCount === 'number' || payload.totalCount === null)
    && Array.isArray(payload.activities)
  )
}
