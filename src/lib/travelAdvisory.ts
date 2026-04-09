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

const DEFAULT_TRAVEL_API_BASE = 'https://soul-cartography-advisory-api.mitchellrbenjamin.workers.dev'
const ENDPOINT_PATH = '/api/v1/travel-advisory'
const SUCCESS_CACHE_TTL_MS = 15 * 60 * 1000
const ERROR_CACHE_TTL_MS = 60 * 1000

const advisoryCache = new Map<string, { expiresAt: number, data: TravelAdvisoryLookup }>()

function resolveTravelApiBase(): string {
  const configured = (import.meta.env.VITE_TRAVEL_API_BASE as string | undefined)?.replace(/\/+$/, '')
  if (configured) return configured

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8787'
    }
  }

  return DEFAULT_TRAVEL_API_BASE
}

function advisoryUrl(country: string): string {
  const query = `country=${encodeURIComponent(country)}`
  const apiBase = resolveTravelApiBase()
  return apiBase ? `${apiBase}${ENDPOINT_PATH}?${query}` : `${ENDPOINT_PATH}?${query}`
}

export async function fetchTravelAdvisory(
  country: string,
  signal?: AbortSignal,
): Promise<TravelAdvisoryLookup> {
  const normalizedCountry = country.trim()
  if (!normalizedCountry) {
    return { status: 'not_found' }
  }

  const cacheKey = normalizedCountry.toLowerCase()
  const cached = advisoryCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  try {
    const url = advisoryUrl(normalizedCountry)
    const response = await fetch(url, { signal })
    if (response.status === 404) {
      const result: TravelAdvisoryLookup = { status: 'not_found' }
      advisoryCache.set(cacheKey, { expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS, data: result })
      return result
    }
    if (!response.ok) {
      console.warn('Travel advisory request failed', {
        country: normalizedCountry,
        status: response.status,
        url,
      })
      return cacheUnavailableResult(cacheKey)
    }

    const payload = await response.json() as Partial<TravelAdvisory>
    if (!isTravelAdvisory(payload)) {
      console.warn('Travel advisory response payload was invalid', {
        country: normalizedCountry,
        url,
      })
      return cacheUnavailableResult(cacheKey)
    }

    const result: TravelAdvisoryLookup = { status: 'ok', advisory: payload }
    advisoryCache.set(cacheKey, {
      expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS,
      data: result,
    })

    return result
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.warn('Travel advisory request failed', {
        country: normalizedCountry,
        error,
        url: advisoryUrl(normalizedCountry),
      })
    }
    return cacheUnavailableResult(cacheKey)
  }
}

function cacheUnavailableResult(cacheKey: string): TravelAdvisoryLookup {
  const result: TravelAdvisoryLookup = { status: 'unavailable' }
  advisoryCache.set(cacheKey, {
    expiresAt: Date.now() + ERROR_CACHE_TTL_MS,
    data: result,
  })
  return result
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
