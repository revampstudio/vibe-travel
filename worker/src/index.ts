import {
  matchAdvisoryByCountry,
  parseSmartravellerExport,
  type AdvisoryDestination,
} from './smartraveller'
import { fetchViatorActivities } from './viator'
import bundledSnapshotPayload from '../fixtures/smartraveller.snapshot.json'

const SOURCE_URL = 'https://www.smartraveller.gov.au/destinations-export'
const CACHE_KEY_URL = 'https://cache.vibe-travel.internal/smartraveller/v2'
const MAX_SNAPSHOT_AGE_MS = 6 * 60 * 60 * 1000
const UPSTREAM_TIMEOUT_MS = 8000

interface WorkerEnv {
  SMARTRAVELLER_EXPORT_URL?: string
  VIATOR_API_BASE?: string
  VIATOR_API_KEY?: string
  VIATOR_CAMPAIGN_VALUE?: string
}

interface AdvisorySnapshot {
  asOf: string
  fetchedAt: string
  sourceUrl: string
  destinations: AdvisoryDestination[]
}

interface AdvisoryApiResponse {
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

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: WorkerExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    const url = new URL(request.url)
    const path = trimTrailingSlash(url.pathname)

    if (request.method === 'GET' && path === '/api/v1/health') {
      return jsonResponse({ ok: true, source: advisorySourceUrl(env) })
    }

    if (
      request.method === 'GET'
      && (path === '/api/v1/travel-advisory' || path === '/api/travel-advisory')
    ) {
      return handleTravelAdvisoryRequest(url, env, ctx)
    }

    if (
      request.method === 'GET'
      && (path === '/api/v1/city-activities' || path === '/api/city-activities')
    ) {
      return handleCityActivitiesRequest(url, env, ctx)
    }

    return jsonResponse({
      error: 'Not found',
      endpoints: [
        '/api/v1/health',
        '/api/v1/travel-advisory?country=Japan',
        '/api/v1/city-activities?city=Lisbon&country=Portugal',
      ],
    }, 404)
  },
}

async function handleTravelAdvisoryRequest(
  url: URL,
  env: WorkerEnv,
  ctx: WorkerExecutionContext,
): Promise<Response> {
  const country = url.searchParams.get('country')?.trim() ?? ''
  if (!country) {
    return jsonResponse({ error: 'Missing required query parameter: country' }, 400)
  }

  const snapshotResult = await getSnapshot(env, ctx, {
    useBundledFallback: isLocalDevelopmentHost(url.hostname),
  })
  if (!snapshotResult) {
    return jsonResponse(
      { error: 'Upstream advisory feed unavailable and no cached snapshot is present' },
      503,
    )
  }

  const { advisory, suggestions } = matchAdvisoryByCountry(country, snapshotResult.snapshot.destinations)
  if (!advisory) {
    return jsonResponse(
      { error: `No advisory found for "${country}"`, suggestions },
      404,
    )
  }

  const response: AdvisoryApiResponse = {
    country,
    matchedCountry: advisory.country,
    adviceLevel: advisory.adviceLevel,
    adviceLabel: advisory.adviceLabel,
    summary: advisory.summary,
    updatedAt: advisory.updatedAt === new Date(0).toISOString()
      ? snapshotResult.snapshot.asOf
      : advisory.updatedAt,
    sourceUrl: advisory.sourceUrl,
    regionalAdvisories: advisory.regionalAdvisories,
    asOf: snapshotResult.snapshot.asOf,
    freshness: snapshotResult.freshness,
  }

  return jsonResponse(response, 200, { 'cache-control': 'public, max-age=900, stale-while-revalidate=43200' })
}

async function handleCityActivitiesRequest(
  url: URL,
  env: WorkerEnv,
  ctx: WorkerExecutionContext,
): Promise<Response> {
  const city = url.searchParams.get('city')?.trim() ?? ''
  const country = url.searchParams.get('country')?.trim() ?? ''
  const limit = clampLimit(url.searchParams.get('limit'))

  if (!city || !country) {
    return jsonResponse({ error: 'Missing required query parameters: city and country' }, 400)
  }

  const apiKey = env.VIATOR_API_KEY?.trim()
  if (!apiKey) {
    return jsonResponse(
      { error: 'Viator integration is not configured', code: 'not_configured' },
      503,
    )
  }

  const cache = await caches.open('city-activities-cache-v1')
  const cacheKey = new Request(
    `https://cache.vibe-travel.internal/city-activities/v2?${new URLSearchParams({
      city,
      country,
      limit: String(limit),
    }).toString()}`,
  )

  const cached = await cache.match(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const responsePayload = await fetchViatorActivities({
      apiKey,
      city,
      country,
      limit,
      baseUrl: env.VIATOR_API_BASE,
      campaignValue: env.VIATOR_CAMPAIGN_VALUE,
    })

    const response = jsonResponse(
      responsePayload,
      200,
      { 'cache-control': 'public, max-age=1800, stale-while-revalidate=21600' },
    )
    ctx.waitUntil(cache.put(cacheKey, response.clone()))
    return response
  } catch (error) {
    console.error('Failed to load city activities from Viator', { city, country, error })
    return jsonResponse({ error: 'Live activities are temporarily unavailable' }, 503)
  }
}

async function getSnapshot(
  env: WorkerEnv,
  ctx: WorkerExecutionContext,
  options: { useBundledFallback: boolean },
): Promise<{ snapshot: AdvisorySnapshot, freshness: 'fresh' | 'stale' } | null> {
  const cache = await caches.open('travel-advisory-cache-v1')
  const cacheKey = new Request(CACHE_KEY_URL)
  const cached = await cache.match(cacheKey)
  const cachedSnapshot = cached ? await tryParseSnapshot(cached) : null

  if (cachedSnapshot && isSnapshotFresh(cachedSnapshot.fetchedAt)) {
    return { snapshot: cachedSnapshot, freshness: 'fresh' }
  }

  try {
    const freshSnapshot = await fetchAndNormalizeSnapshot(env, options)
    const cacheResponse = new Response(JSON.stringify(freshSnapshot), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': `public, max-age=${Math.floor(MAX_SNAPSHOT_AGE_MS / 1000)}`,
      },
    })
    ctx.waitUntil(cache.put(cacheKey, cacheResponse))
    return { snapshot: freshSnapshot, freshness: 'fresh' }
  } catch {
    if (cachedSnapshot) {
      return { snapshot: cachedSnapshot, freshness: 'stale' }
    }
    return null
  }
}

async function fetchAndNormalizeSnapshot(
  env: WorkerEnv,
  options: { useBundledFallback: boolean },
): Promise<AdvisorySnapshot> {
  const sourceUrl = advisorySourceUrl(env)
  const payload = await fetchSnapshotPayload(sourceUrl, options.useBundledFallback)
  const destinations = parseSmartravellerExport(payload)

  if (!destinations.length) {
    throw new Error('Advisory payload returned no destinations')
  }

  const nowIso = new Date().toISOString()
  return {
    asOf: nowIso,
    fetchedAt: nowIso,
    sourceUrl,
    destinations,
  }
}

async function fetchSnapshotPayload(
  sourceUrl: string,
  useBundledFallback: boolean,
): Promise<unknown> {
  try {
    return await fetchJsonWithTimeout(sourceUrl, UPSTREAM_TIMEOUT_MS)
  } catch (error) {
    if (useBundledFallback && sourceUrl === SOURCE_URL) {
      console.warn('Falling back to bundled Smartraveller snapshot in local development', { error })
      return bundledSnapshotPayload
    }
    throw error
  }
}

async function fetchJsonWithTimeout(sourceUrl: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': 'vibe-travel-advisory-api/1.0',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Failed upstream request: ${response.status}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

function advisorySourceUrl(env: WorkerEnv): string {
  const configured = env.SMARTRAVELLER_EXPORT_URL?.trim()
  return configured || SOURCE_URL
}

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost'
}

function isSnapshotFresh(fetchedAt: string): boolean {
  const timestamp = Date.parse(fetchedAt)
  if (!Number.isFinite(timestamp)) return false
  return Date.now() - timestamp <= MAX_SNAPSHOT_AGE_MS
}

async function tryParseSnapshot(response: Response): Promise<AdvisorySnapshot | null> {
  try {
    const parsed = await response.json() as AdvisorySnapshot
    if (!parsed || !Array.isArray(parsed.destinations)) return null
    return parsed
  } catch {
    return null
  }
}

function trimTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function clampLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return 8
  return Math.min(12, Math.max(1, parsed))
}

function jsonResponse(
  payload: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...extraHeaders,
    },
  })
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type',
  }
}
