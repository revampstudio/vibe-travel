import { loadCities } from '../data/loadCities'

export interface GeoResult {
  place_name: string
  center: [number, number]
}

interface IndexedCity {
  result: GeoResult
  city: string
  country: string
  place: string
}

interface SearchBirthCitiesOptions {
  limit?: number
  includeMapbox?: boolean
  mapboxToken?: string
}

const MIN_QUERY_LENGTH = 2
const DEFAULT_LIMIT = 5

let cityIndexPromise: Promise<IndexedCity[]> | null = null

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasValidMapboxToken(token: string | undefined): token is string {
  return Boolean(token && token !== 'your_mapbox_token_here')
}

function getResultKey(result: GeoResult): string {
  const lng = result.center[0].toFixed(4)
  const lat = result.center[1].toFixed(4)
  return `${normalizeForSearch(result.place_name)}|${lng}|${lat}`
}

async function getCityIndex(): Promise<IndexedCity[]> {
  if (!cityIndexPromise) {
    cityIndexPromise = loadCities().then((cities) =>
      cities.map((city) => {
        const placeName = `${city.name}, ${city.country}`
        return {
          result: {
            place_name: placeName,
            center: [city.lng, city.lat],
          },
          city: normalizeForSearch(city.name),
          country: normalizeForSearch(city.country),
          place: normalizeForSearch(placeName),
        }
      }),
    )
  }

  return cityIndexPromise
}

function scoreLocalMatch(entry: IndexedCity, normalizedQuery: string): number {
  if (entry.city === normalizedQuery) return 0
  if (entry.city.startsWith(normalizedQuery)) return 1

  const cityMatchIndex = entry.city.indexOf(normalizedQuery)
  if (cityMatchIndex >= 0) return 2 + cityMatchIndex / 100

  if (entry.place.startsWith(normalizedQuery)) return 3

  const placeMatchIndex = entry.place.indexOf(normalizedQuery)
  if (placeMatchIndex >= 0) return 4 + placeMatchIndex / 100

  if (entry.country.startsWith(normalizedQuery)) return 5

  const countryMatchIndex = entry.country.indexOf(normalizedQuery)
  if (countryMatchIndex >= 0) return 6 + countryMatchIndex / 100

  return Number.POSITIVE_INFINITY
}

async function searchLocalCities(query: string, limit: number): Promise<GeoResult[]> {
  const normalizedQuery = normalizeForSearch(query)
  if (normalizedQuery.length < MIN_QUERY_LENGTH) return []

  const cityIndex = await getCityIndex()

  const matches = cityIndex
    .map((entry) => ({
      entry,
      score: scoreLocalMatch(entry, normalizedQuery),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      return a.entry.result.place_name.localeCompare(b.entry.result.place_name)
    })

  return matches.slice(0, limit).map(({ entry }) => entry.result)
}

async function searchMapboxCities(query: string, token: string, limit: number): Promise<GeoResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?types=place&limit=${limit}&access_token=${token}`,
    )
    if (!response.ok) return []

    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('features' in payload)) return []

    const features = (payload as { features: unknown }).features
    if (!Array.isArray(features)) return []

    return features
      .map((feature): GeoResult | null => {
        if (!feature || typeof feature !== 'object') return null

        const placeName = 'place_name' in feature ? feature.place_name : null
        const center = 'center' in feature ? feature.center : null
        if (typeof placeName !== 'string' || !Array.isArray(center) || center.length < 2) return null

        const [lng, lat] = center
        if (typeof lng !== 'number' || typeof lat !== 'number') return null

        return {
          place_name: placeName,
          center: [lng, lat],
        }
      })
      .filter((result): result is GeoResult => Boolean(result))
  } catch {
    return []
  }
}

export async function preloadBirthCityAutocomplete(): Promise<void> {
  await getCityIndex()
}

export async function searchBirthCities(
  query: string,
  options: SearchBirthCitiesOptions = {},
): Promise<GeoResult[]> {
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT)
  const localResults = await searchLocalCities(query, limit)

  if (!options.includeMapbox || localResults.length >= limit || !hasValidMapboxToken(options.mapboxToken)) {
    return localResults
  }

  const mapboxResults = await searchMapboxCities(query, options.mapboxToken, limit)
  if (mapboxResults.length === 0) return localResults

  const mergedResults: GeoResult[] = []
  const seen = new Set<string>()

  const addUnique = (result: GeoResult) => {
    const key = getResultKey(result)
    if (seen.has(key) || mergedResults.length >= limit) return
    seen.add(key)
    mergedResults.push(result)
  }

  localResults.forEach(addUnique)
  mapboxResults.forEach(addUnique)

  return mergedResults
}
