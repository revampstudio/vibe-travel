export interface WikiSummaryResult {
  summary: string
  pageTitle: string
  pageUrl: string | null
}

interface WikiSummaryApiResponse {
  type?: string
  title?: string
  description?: string
  extract?: string
  coordinates?: {
    lat?: number
    lon?: number
  }
  content_urls?: {
    desktop?: {
      page?: string
    }
  }
}

interface WikiSearchApiResponse {
  query?: {
    search?: Array<{
      title?: string
      snippet?: string
    }>
  }
}

interface WikiGeoSearchApiResponse {
  query?: {
    geosearch?: Array<{
      title?: string
      dist?: number
    }>
  }
}

interface SummaryCandidate {
  title: string
  description: string
  extract: string
  url: string | null
  latitude: number | null
  longitude: number | null
  searchSnippet: string
  source: 'exact' | 'geo' | 'search' | 'disambiguation'
  rank: number
}

const WIKI_SUMMARY_BASE_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
const WIKI_ACTION_API_URL = 'https://en.wikipedia.org/w/api.php'
const GEOSEARCH_RADIUS_METERS = 20_000
const MAX_GEO_TITLES = 6
const MAX_SEARCH_TITLES = 6
const COUNTRY_VARIANTS: Record<string, string[]> = {
  burma: ['burma', 'myanmar'],
  myanmar: ['myanmar', 'burma'],
  turkey: ['turkey', 'turkiye'],
  turkiye: ['turkiye', 'turkey'],
  ukraine: ['ukraine', 'ukrainian'],
  russia: ['russia', 'russian'],
}
const NON_PLACE_PATTERNS = [
  /\bworld war\b/i,
  /\bolympics\b/i,
  /\buprising\b/i,
  /\bbombing\b/i,
  /\binvasion\b/i,
  /\battack\b/i,
  /\belection\b/i,
  /\bcampaign\b/i,
  /\btreaty\b/i,
  /\bhistory of\b/i,
]

export async function fetchCityWikiSummary(
  city: string,
  country: string,
  latitude?: number,
  longitude?: number,
  signal?: AbortSignal,
): Promise<WikiSummaryResult | null> {
  const normalizedCity = city.trim()
  const normalizedCountry = country.trim()
  if (!normalizedCity || !normalizedCountry) return null

  const titleSources = await collectCandidateTitles(
    normalizedCity,
    normalizedCountry,
    latitude,
    longitude,
    signal,
  )

  const candidates = (
    await Promise.all(titleSources.map((source, index) => (
      fetchSummaryCandidate(source.title, {
        signal,
        source: source.source,
        rank: index,
        searchSnippet: source.searchSnippet,
      })
    )))
  ).filter((candidate): candidate is SummaryCandidate => candidate !== null)

  if (candidates.length === 0) return null

  const strongGeoCandidate = pickStrongGeoCandidate(
    candidates,
    normalizedCountry,
    latitude,
    longitude,
  )
  if (strongGeoCandidate) {
    return {
      summary: truncateSummary(strongGeoCandidate.extract),
      pageTitle: strongGeoCandidate.title,
      pageUrl: strongGeoCandidate.url,
    }
  }

  const bestCandidate = [...candidates].sort((left, right) => (
    scoreCandidate(right, normalizedCity, normalizedCountry, latitude, longitude)
    - scoreCandidate(left, normalizedCity, normalizedCountry, latitude, longitude)
  ))[0]

  if (!bestCandidate) return null

  return {
    summary: truncateSummary(bestCandidate.extract),
    pageTitle: bestCandidate.title,
    pageUrl: bestCandidate.url,
  }
}

function pickStrongGeoCandidate(
  candidates: SummaryCandidate[],
  country: string,
  latitude?: number,
  longitude?: number,
): SummaryCandidate | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const normalizedCountry = normalizeText(country)
  const geoCandidates = candidates
    .map((candidate) => {
      if (!Number.isFinite(candidate.latitude) || !Number.isFinite(candidate.longitude)) {
        return null
      }

      const distanceKm = haversineDistanceKm(
        latitude as number,
        longitude as number,
        candidate.latitude as number,
        candidate.longitude as number,
      )

      return {
        candidate,
        distanceKm,
        combinedText: normalizeText(
          `${candidate.title} ${candidate.description} ${candidate.extract} ${candidate.searchSnippet}`,
        ),
      }
    })
    .filter((entry): entry is { candidate: SummaryCandidate, distanceKm: number, combinedText: string } => entry !== null)
    .filter((entry) => entry.distanceKm <= 25)
    .filter((entry) => entry.combinedText.includes(normalizedCountry))
    .filter((entry) => normalizeText(entry.candidate.description).includes('city'))
    .sort((left, right) => left.distanceKm - right.distanceKm)

  return geoCandidates[0]?.candidate ?? null
}

async function collectCandidateTitles(
  city: string,
  country: string,
  latitude?: number,
  longitude?: number,
  signal?: AbortSignal,
): Promise<Array<{ title: string, source: 'exact' | 'geo' | 'search' | 'disambiguation', searchSnippet: string }>> {
  const seen = new Set<string>()
  const titles: Array<{ title: string, source: 'exact' | 'geo' | 'search' | 'disambiguation', searchSnippet: string }> = []

  const addTitle = (
    title: string,
    source: 'exact' | 'geo' | 'search' | 'disambiguation',
    searchSnippet = '',
  ) => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const key = normalizeText(trimmedTitle)
    if (!key || seen.has(key)) return
    seen.add(key)
    titles.push({ title: trimmedTitle, source, searchSnippet })
  }

  addTitle(`${city}, ${country}`, 'exact')
  addTitle(city, 'exact')

  const disambiguationTitles = await fetchDisambiguationTitles(city, signal)
  disambiguationTitles.forEach((entry) => addTitle(entry.title, 'disambiguation', entry.searchSnippet))

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const nearbyTitles = await fetchGeoSearchTitles(latitude as number, longitude as number, signal)
    nearbyTitles.slice(0, MAX_GEO_TITLES).forEach((entry) => addTitle(entry.title, 'geo'))
  }

  const searchTitles = await fetchSearchTitles(city, country, signal)
  searchTitles.slice(0, MAX_SEARCH_TITLES).forEach((entry) => (
    addTitle(entry.title, 'search', entry.searchSnippet)
  ))

  return titles
}

async function fetchSummaryCandidate(
  title: string,
  options: {
    signal?: AbortSignal
    source: 'exact' | 'geo' | 'search' | 'disambiguation'
    rank: number
    searchSnippet: string
  },
): Promise<SummaryCandidate | null> {
  const response = await fetch(
    `${WIKI_SUMMARY_BASE_URL}${encodeURIComponent(title.replace(/ /g, '_'))}`,
    { signal: options.signal },
  )

  if (!response.ok) return null

  const payload = await response.json() as WikiSummaryApiResponse
  const extract = payload.extract?.trim() ?? ''
  if (!extract || isBadSummary(payload, extract)) {
    return null
  }

  return {
    title: payload.title?.trim() || title,
    description: payload.description?.trim() ?? '',
    extract,
    url: payload.content_urls?.desktop?.page ?? null,
    latitude: Number.isFinite(payload.coordinates?.lat) ? payload.coordinates?.lat ?? null : null,
    longitude: Number.isFinite(payload.coordinates?.lon) ? payload.coordinates?.lon ?? null : null,
    searchSnippet: options.searchSnippet,
    source: options.source,
    rank: options.rank,
  }
}

async function fetchGeoSearchTitles(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<Array<{ title: string }>> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'geosearch',
    gscoord: `${latitude}|${longitude}`,
    gsradius: String(GEOSEARCH_RADIUS_METERS),
    gslimit: String(MAX_GEO_TITLES),
    format: 'json',
    origin: '*',
  })

  const response = await fetch(`${WIKI_ACTION_API_URL}?${params.toString()}`, { signal })
  if (!response.ok) return []

  const payload = await response.json() as WikiGeoSearchApiResponse
  return (payload.query?.geosearch ?? [])
    .map((entry) => ({ title: entry.title?.trim() ?? '' }))
    .filter((entry) => Boolean(entry.title))
}

async function fetchSearchTitles(
  city: string,
  country: string,
  signal?: AbortSignal,
): Promise<Array<{ title: string, searchSnippet: string }>> {
  const queryTerms = [
    `"${city}" "${country}"`,
    `${city} ${country}`,
    `${city} ${country} city`,
  ]

  const results: Array<{ title: string, searchSnippet: string }> = []
  const seen = new Set<string>()

  for (const query of queryTerms) {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '8',
      format: 'json',
      origin: '*',
    })

    const response = await fetch(`${WIKI_ACTION_API_URL}?${params.toString()}`, { signal })
    if (!response.ok) continue

    const payload = await response.json() as WikiSearchApiResponse
    for (const entry of payload.query?.search ?? []) {
      const title = entry.title?.trim() ?? ''
      const key = normalizeText(title)
      if (!title || !key || seen.has(key)) continue

      seen.add(key)
      results.push({
        title,
        searchSnippet: stripHtml(entry.snippet ?? ''),
      })
    }
  }

  return results
}

async function fetchDisambiguationTitles(
  city: string,
  signal?: AbortSignal,
): Promise<Array<{ title: string, searchSnippet: string }>> {
  const response = await fetch(
    `${WIKI_SUMMARY_BASE_URL}${encodeURIComponent(city.replace(/ /g, '_'))}`,
    { signal },
  )
  if (!response.ok) return []

  const payload = await response.json() as WikiSummaryApiResponse
  if (payload.type?.toLowerCase() !== 'disambiguation') return []

  const extract = payload.extract?.trim() ?? ''
  if (!extract) return []

  const listText = extract.replace(/^[^:]+:\s*/, '')
  return listText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title] = line.split(',')
      return {
        title: (title ?? '').trim(),
        searchSnippet: extract,
      }
    })
    .filter((entry) => Boolean(entry.title))
}

function isBadSummary(payload: WikiSummaryApiResponse, extract: string): boolean {
  const type = payload.type?.toLowerCase() ?? ''
  const description = payload.description?.toLowerCase() ?? ''
  const normalizedExtract = normalizeText(extract)

  if (type && type !== 'standard') return true
  if (description.includes('disambiguation')) return true
  if (description.includes('topics referred to by the same term')) return true
  if (description.startsWith('wikimedia list article')) return true
  if (normalizedExtract.includes('may refer to')) return true
  if (normalizedExtract.startsWith('list of ')) return true

  return false
}

function scoreCandidate(
  candidate: SummaryCandidate,
  city: string,
  country: string,
  latitude?: number,
  longitude?: number,
): number {
  const normalizedCity = normalizeText(city)
  const normalizedTitle = normalizeText(candidate.title)
  const normalizedDescription = normalizeText(candidate.description)
  const normalizedExtract = normalizeText(candidate.extract)
  const normalizedSnippet = normalizeText(candidate.searchSnippet)
  const combinedText = `${normalizedTitle} ${normalizedDescription} ${normalizedExtract} ${normalizedSnippet}`.trim()
  const countryVariants = countrySearchTerms(country)

  let score = 0

  if (candidate.source === 'exact') score += 20
  if (candidate.source === 'geo') score += 30
  if (candidate.source === 'search') score += 10
  if (candidate.source === 'disambiguation') score += 25

  score += Math.max(0, 12 - candidate.rank)

  if (countryVariants.some((term) => combinedText.includes(term))) score += 40
  if (combinedText.includes(normalizedCity)) score += 20
  if (countryVariants.some((term) => normalizedSnippet.includes(term)) && normalizedSnippet.includes(normalizedCity)) score += 25
  if (normalizedDescription.includes('city')) score += 15
  if (normalizedDescription.includes('capital')) score += 10
  if (normalizedDescription.includes('town')) score += 8
  if (normalizedTitle === normalizedCity) score += 10
  if (normalizedExtract.startsWith(`${normalizedTitle} is a city`)) score += 20
  if (normalizedExtract.startsWith(`${normalizedTitle} is the capital`)) score += 20

  if (NON_PLACE_PATTERNS.some((pattern) => pattern.test(candidate.title) || pattern.test(candidate.extract))) {
    score -= 80
  }

  if (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && Number.isFinite(candidate.latitude)
    && Number.isFinite(candidate.longitude)
  ) {
    const distanceKm = haversineDistanceKm(
      latitude as number,
      longitude as number,
      candidate.latitude as number,
      candidate.longitude as number,
    )

    if (distanceKm <= 10) score += 80
    else if (distanceKm <= 50) score += 60
    else if (distanceKm <= 150) score += 35
    else if (distanceKm <= 500) score += 15
    else score -= 20
  }

  return score
}

function countrySearchTerms(country: string): string[] {
  const normalized = normalizeText(country)
  return COUNTRY_VARIANTS[normalized] ?? [normalized]
}

function truncateSummary(extract: string): string {
  const sentences = extract
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)

  if (sentences.length <= 2) {
    return sentences.join(' ')
  }

  return sentences.slice(0, 2).join(' ')
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadiusKm = 6371
  const latitudeDelta = toRadians(latitudeB - latitudeA)
  const longitudeDelta = toRadians(longitudeB - longitudeA)
  const a = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA))
    * Math.cos(toRadians(latitudeB))
    * Math.sin(longitudeDelta / 2) ** 2
  )

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a))
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}
