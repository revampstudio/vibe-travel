import bundledAdvisories from '@/src/data/travel-advisories.json'

export interface TravelAdvisory {
  country: string
  matchedCountry: string
  adviceLevel: 1 | 2 | 3 | 4
  adviceLabel: string
  summary: string
  updatedAt: string
  sourceUrl: string
  regionalAdvisories: string[]
  asOf: string
  freshness: 'fresh' | 'stale'
}

export type TravelAdvisoryLookup =
  | { status: 'ok', advisory: TravelAdvisory }
  | { status: 'not_found' }
  | { status: 'unavailable' }

const DEFAULT_TRAVEL_API_BASE = 'https://vibe-travel-advisory-api.mitchellrbenjamin.workers.dev'
const ENDPOINT_PATH = '/api/v1/travel-advisory'
const SUCCESS_CACHE_TTL_MS = 15 * 60 * 1000
const ERROR_CACHE_TTL_MS = 60 * 1000

const advisoryCache = new Map<string, { expiresAt: number, data: TravelAdvisoryLookup }>()
const fallbackAdvisories = bundledAdvisories as Record<string, TravelAdvisory>

const COUNTRY_ALIAS_MAP: Record<string, string> = {
  burma: 'myanmar',
  'cabo verde': 'cape verde',
  'cape verde': 'cape verde',
  'congo kinshasa': 'democratic republic of the congo',
  'congo brazzaville': 'republic of the congo',
  'congo democratic republic of': 'democratic republic of the congo',
  'democratic republic of congo': 'democratic republic of the congo',
  'dr congo': 'democratic republic of the congo',
  drc: 'democratic republic of the congo',
  'republic of congo': 'republic of the congo',
  'cote divoire': "cote d'ivoire",
  'ivory coast': "cote d'ivoire",
  czechia: 'czech republic',
  laos: 'lao pdr',
  russia: 'russian federation',
  'south korea': 'republic of korea',
  'north korea': "democratic people's republic of korea",
  syria: 'syrian arab republic',
  turkiye: 'turkey',
  uae: 'united arab emirates',
  uk: 'united kingdom',
  usa: 'united states of america',
  us: 'united states of america',
  'vatican city': 'holy see',
}

const SPLIT_JOIN_PATTERN = /\band\b/g
const NON_ALNUM_PATTERN = /[^a-z0-9]+/g
const PARENS_CHAR_PATTERN = /[()]/g

function resolveTravelApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_TRAVEL_API_BASE?.replace(/\/+$/, '')
  if (configured) return configured

  return DEFAULT_TRAVEL_API_BASE
}

function advisoryUrl(country: string): string {
  const query = `country=${encodeURIComponent(country)}`
  return `${resolveTravelApiBase()}${ENDPOINT_PATH}?${query}`
}

export async function fetchTravelAdvisory(
  country: string,
  signal?: AbortSignal,
): Promise<TravelAdvisoryLookup> {
  const normalizedCountry = country.trim()
  if (!normalizedCountry) return { status: 'not_found' }

  const cacheKey = normalizedCountry.toLowerCase()
  const cached = advisoryCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  try {
    const response = await fetch(advisoryUrl(normalizedCountry), { signal })

    if (response.status === 404) {
      return cacheLookup(cacheKey, fallbackLookup(normalizedCountry))
    }

    if (!response.ok) {
      return cacheLookup(cacheKey, fallbackLookup(normalizedCountry), true)
    }

    const payload = await response.json() as Partial<TravelAdvisory>
    if (!isTravelAdvisory(payload)) {
      return cacheLookup(cacheKey, fallbackLookup(normalizedCountry), true)
    }

    return cacheLookup(cacheKey, { status: 'ok', advisory: payload })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    return cacheLookup(cacheKey, fallbackLookup(normalizedCountry), true)
  }
}

function fallbackLookup(country: string): TravelAdvisoryLookup {
  const exact = fallbackAdvisories[canonicalCountryKey(country)]
  if (exact) {
    return { status: 'ok', advisory: { ...exact, freshness: 'stale' } }
  }

  const canonical = canonicalCountryKey(country)
  const tokens = canonical.split(' ').filter(Boolean)
  for (const [key, advisory] of Object.entries(fallbackAdvisories)) {
    if (tokens.length > 0 && tokens.every((token) => key.includes(token))) {
      return { status: 'ok', advisory: { ...advisory, freshness: 'stale' } }
    }
  }

  return { status: 'not_found' }
}

function cacheLookup(
  cacheKey: string,
  result: TravelAdvisoryLookup,
  preferShortTtl = false,
): TravelAdvisoryLookup {
  advisoryCache.set(cacheKey, {
    expiresAt: Date.now() + (
      result.status === 'unavailable' || preferShortTtl
        ? ERROR_CACHE_TTL_MS
        : SUCCESS_CACHE_TTL_MS
    ),
    data: result,
  })
  return result
}

function canonicalCountryKey(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(PARENS_CHAR_PATTERN, ' ')
    .replace(/&/g, ' and ')
    .replace(SPLIT_JOIN_PATTERN, ' ')
    .toLowerCase()
    .replace(NON_ALNUM_PATTERN, ' ')
    .trim()
    .replace(/\s+/g, ' ')

  return COUNTRY_ALIAS_MAP[normalized] ?? normalized
}

function isTravelAdvisory(payload: Partial<TravelAdvisory>): payload is TravelAdvisory {
  return (
    typeof payload.country === 'string'
    && typeof payload.matchedCountry === 'string'
    && typeof payload.adviceLevel === 'number'
    && payload.adviceLevel >= 1
    && payload.adviceLevel <= 4
    && Number.isInteger(payload.adviceLevel)
    && typeof payload.adviceLabel === 'string'
    && typeof payload.summary === 'string'
    && typeof payload.updatedAt === 'string'
    && typeof payload.sourceUrl === 'string'
    && Array.isArray(payload.regionalAdvisories)
    && typeof payload.asOf === 'string'
    && (payload.freshness === 'fresh' || payload.freshness === 'stale')
  )
}
