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

const API_BASE = (import.meta.env.VITE_TRAVEL_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? ''
const ENDPOINT_PATH = '/api/v1/travel-advisory'
const CACHE_TTL_MS = 15 * 60 * 1000

const advisoryCache = new Map<string, { expiresAt: number, data: TravelAdvisory | null }>()

function advisoryUrl(country: string): string {
  const query = `country=${encodeURIComponent(country)}`
  return API_BASE ? `${API_BASE}${ENDPOINT_PATH}?${query}` : `${ENDPOINT_PATH}?${query}`
}

export async function fetchTravelAdvisory(
  country: string,
  signal?: AbortSignal,
): Promise<TravelAdvisory | null> {
  const normalizedCountry = country.trim()
  if (!normalizedCountry) return null

  const cacheKey = normalizedCountry.toLowerCase()
  const cached = advisoryCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  try {
    const response = await fetch(advisoryUrl(normalizedCountry), { signal })
    if (response.status === 404) {
      advisoryCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: null })
      return null
    }
    if (!response.ok) {
      return null
    }

    const payload = await response.json() as Partial<TravelAdvisory>
    if (!isTravelAdvisory(payload)) {
      return null
    }

    advisoryCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      data: payload,
    })

    return payload
  } catch {
    return null
  }
}

function isTravelAdvisory(payload: Partial<TravelAdvisory>): payload is TravelAdvisory {
  return (
    typeof payload.country === 'string'
    && typeof payload.matchedCountry === 'string'
    && typeof payload.adviceLevel === 'number'
    && payload.adviceLevel >= 1
    && payload.adviceLevel <= 4
    && typeof payload.adviceLabel === 'string'
    && typeof payload.summary === 'string'
    && typeof payload.updatedAt === 'string'
    && typeof payload.sourceUrl === 'string'
    && Array.isArray(payload.regionalAdvisories)
    && typeof payload.asOf === 'string'
    && (payload.freshness === 'fresh' || payload.freshness === 'stale')
  )
}
