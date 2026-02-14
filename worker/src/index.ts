import {
  matchAdvisoryByCountry,
  parseSmartravellerExport,
  type AdvisoryDestination,
} from './smartraveller'

const SOURCE_URL = 'https://www.smartraveller.gov.au/destinations-export'
const CACHE_KEY_URL = 'https://cache.soul-cartography.internal/smartraveller/v2'
const MAX_SNAPSHOT_AGE_MS = 6 * 60 * 60 * 1000

interface WorkerEnv {
  SMARTRAVELLER_EXPORT_URL?: string
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

    return jsonResponse({
      error: 'Not found',
      endpoints: ['/api/v1/health', '/api/v1/travel-advisory?country=Japan'],
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

  const snapshotResult = await getSnapshot(env, ctx)
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

async function getSnapshot(
  env: WorkerEnv,
  ctx: WorkerExecutionContext,
): Promise<{ snapshot: AdvisorySnapshot, freshness: 'fresh' | 'stale' } | null> {
  const cache = await caches.open('travel-advisory-cache-v1')
  const cacheKey = new Request(CACHE_KEY_URL)
  const cached = await cache.match(cacheKey)
  const cachedSnapshot = cached ? await tryParseSnapshot(cached) : null

  if (cachedSnapshot && isSnapshotFresh(cachedSnapshot.fetchedAt)) {
    return { snapshot: cachedSnapshot, freshness: 'fresh' }
  }

  try {
    const freshSnapshot = await fetchAndNormalizeSnapshot(env)
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

async function fetchAndNormalizeSnapshot(env: WorkerEnv): Promise<AdvisorySnapshot> {
  const sourceUrl = advisorySourceUrl(env)
  const response = await fetch(sourceUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'soul-cartography-advisory-api/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed upstream request: ${response.status}`)
  }

  const payload = await response.json()
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

function advisorySourceUrl(env: WorkerEnv): string {
  const configured = env.SMARTRAVELLER_EXPORT_URL?.trim()
  return configured || SOURCE_URL
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
