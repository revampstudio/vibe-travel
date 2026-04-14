const DEFAULT_VIATOR_API_BASE = 'https://api.viator.com/partner'
const UPSTREAM_TIMEOUT_MS = 8000

export interface ViatorActivity {
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

export interface ViatorCityActivitiesResponse {
  provider: 'viator'
  city: string
  country: string
  searchTerm: string
  fetchedAt: string
  totalCount: number | null
  activities: ViatorActivity[]
}

interface FetchViatorActivitiesOptions {
  apiKey: string
  city: string
  country: string
  limit: number
  campaignValue?: string
  baseUrl?: string
}

interface ViatorSearchResponse {
  products?: {
    totalCount?: number
    results?: ViatorProductSummary[]
  }
}

interface ViatorProductSummary {
  productCode?: string
  title?: string
  description?: string
  shortDescription?: string
  productUrl?: string
  duration?: {
    fixedDurationInMinutes?: number
  }
  pricing?: {
    summary?: {
      fromPrice?: number
      fromPriceFormatted?: string
    }
  }
  reviews?: {
    combinedAverageRating?: number
    totalReviews?: number
  }
  reviewRating?: {
    combinedAverageRating?: number
    totalReviews?: number
  }
  flags?: string[]
  destinations?: Array<{
    name?: string
  }>
  images?: Array<{
    imageURL?: string
    variants?: Array<{
      url?: string
      width?: number
      height?: number
    }>
  }>
}

export async function fetchViatorActivities(
  options: FetchViatorActivitiesOptions,
): Promise<ViatorCityActivitiesResponse> {
  const city = options.city.trim()
  const country = options.country.trim()
  const searchTerm = `${city}, ${country}`
  const url = new URL('search/freetext', `${resolveViatorBaseUrl(options.baseUrl)}/`)

  if (options.campaignValue?.trim()) {
    url.searchParams.set('campaign-value', options.campaignValue.trim())
  }

  const payload = await postJsonWithTimeout<ViatorSearchResponse>(url.toString(), {
    method: 'POST',
    headers: {
      accept: 'application/json;version=2.0',
      'accept-language': 'en-US',
      'content-type': 'application/json',
      'exp-api-key': options.apiKey,
      'user-agent': 'vibe-travel-city-activities/1.0',
    },
    body: JSON.stringify({
      searchTerm,
      searchTypes: [
        {
          searchType: 'PRODUCTS',
          pagination: {
            start: 1,
            count: options.limit,
          },
        },
      ],
      currency: 'USD',
    }),
  })

  const products = Array.isArray(payload.products?.results) ? payload.products.results : []
  const activities = products
    .map(normalizeProduct)
    .filter((activity): activity is ViatorActivity => activity !== null)
    .filter((activity) => isStrongCityMatch(activity, city))

  return {
    provider: 'viator',
    city,
    country,
    searchTerm,
    fetchedAt: new Date().toISOString(),
    totalCount: typeof payload.products?.totalCount === 'number' ? payload.products.totalCount : null,
    activities,
  }
}

function resolveViatorBaseUrl(value?: string): string {
  const trimmed = value?.trim().replace(/\/+$/, '')
  return trimmed || DEFAULT_VIATOR_API_BASE
}

async function postJsonWithTimeout<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Viator request failed with status ${response.status}`)
    }
    return await response.json() as T
  } finally {
    clearTimeout(timeoutId)
  }
}

function normalizeProduct(product: ViatorProductSummary): ViatorActivity | null {
  const providerId = product.productCode?.trim()
  const title = product.title?.trim()
  if (!providerId || !title) return null

  const description = stripHtml(
    product.description?.trim()
    || product.shortDescription?.trim()
    || '',
  )

  const reviewSummary = product.reviews ?? product.reviewRating
  const durationMinutes = toFiniteNumber(product.duration?.fixedDurationInMinutes)
  const priceAmount = toFiniteNumber(product.pricing?.summary?.fromPrice)

  return {
    provider: 'viator',
    providerId,
    title,
    description,
    imageUrl: pickImageUrl(product),
    priceLabel: typeof product.pricing?.summary?.fromPriceFormatted === 'string'
      ? product.pricing.summary.fromPriceFormatted.trim()
      : (priceAmount !== null ? formatUsdPrice(priceAmount) : null),
    priceAmount,
    rating: toFiniteNumber(reviewSummary?.combinedAverageRating),
    reviewCount: toFiniteInteger(reviewSummary?.totalReviews),
    durationMinutes,
    durationLabel: durationMinutes !== null ? formatDuration(durationMinutes) : null,
    url: typeof product.productUrl === 'string' ? product.productUrl.trim() : null,
    flags: Array.isArray(product.flags) ? product.flags.filter((flag) => typeof flag === 'string') : [],
    destinations: Array.isArray(product.destinations)
      ? product.destinations.flatMap((destination) => (
        typeof destination?.name === 'string' && destination.name.trim()
          ? [destination.name.trim()]
          : []
      ))
      : [],
  }
}

function pickImageUrl(product: ViatorProductSummary): string | null {
  if (!Array.isArray(product.images)) return null

  for (const image of product.images) {
    if (typeof image?.imageURL === 'string' && image.imageURL.trim()) {
      return image.imageURL.trim()
    }

    if (!Array.isArray(image?.variants)) continue
    const variants = image.variants
      .filter((variant) => typeof variant?.url === 'string' && variant.url.trim())
      .sort((left, right) => {
        const leftArea = (left.width ?? 0) * (left.height ?? 0)
        const rightArea = (right.width ?? 0) * (right.height ?? 0)
        return rightArea - leftArea
      })

    if (variants[0]?.url) {
      return variants[0].url.trim()
    }
  }

  return null
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toFiniteInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function formatUsdPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}

function formatDuration(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return 'Duration varies'
  }

  if (totalMinutes < 60) {
    return `${Math.round(totalMinutes)} min`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) {
    return `${hours} hr${hours === 1 ? '' : 's'}`
  }

  return `${hours} hr ${minutes} min`
}

function isStrongCityMatch(activity: ViatorActivity, city: string): boolean {
  const normalizedCity = normalizeText(city)
  if (!normalizedCity) return false

  const combinedText = normalizeText([
    activity.title,
    activity.description,
    activity.destinations.join(' '),
  ].join(' '))

  if (combinedText.includes(normalizedCity)) {
    return true
  }

  const urlCitySegment = extractUrlCitySegment(activity.url)
  if (urlCitySegment && urlCitySegment === normalizedCity) {
    return true
  }

  const significantTokens = normalizedCity
    .split(' ')
    .filter((token) => token.length >= 4)

  if (significantTokens.length >= 2 && significantTokens.every((token) => combinedText.includes(token))) {
    return true
  }

  return false
}

function extractUrlCitySegment(value: string | null): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    const toursIndex = url.pathname.split('/').findIndex((part) => part === 'tours')
    if (toursIndex === -1) return null

    const segment = url.pathname.split('/')[toursIndex + 1]
    return segment ? normalizeText(segment) : null
  } catch {
    return null
  }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
