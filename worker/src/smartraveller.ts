import { canonicalCountryKey } from './countryAliases'

export type AdviceLevel = 1 | 2 | 3 | 4

export interface AdvisoryDestination {
  country: string
  adviceLevel: AdviceLevel
  adviceLabel: string
  summary: string
  updatedAt: string
  sourceUrl: string
  regionalAdvisories: string[]
}

const LEVEL_LABELS: Record<AdviceLevel, string> = {
  1: 'Exercise normal safety precautions',
  2: 'Exercise a high degree of caution',
  3: 'Reconsider your need to travel',
  4: 'Do not travel',
}

const LEVEL_PATTERNS: Array<{ level: AdviceLevel, pattern: RegExp }> = [
  { level: 4, pattern: /\bdo not travel\b/i },
  { level: 3, pattern: /\breconsider your need to travel\b/i },
  { level: 2, pattern: /\bhigh degree of caution\b/i },
  { level: 1, pattern: /\bnormal safety precautions?\b/i },
]

const SOURCE_ORIGIN = 'https://www.smartraveller.gov.au'

export function parseSmartravellerExport(payload: unknown): AdvisoryDestination[] {
  const rows = extractRows(payload)
  const parsed = rows
    .map((row) => parseRow(row))
    .filter((row): row is AdvisoryDestination => row !== null)

  // Keep first match per canonical key for stable country lookups.
  const deduped = new Map<string, AdvisoryDestination>()
  for (const destination of parsed) {
    const key = canonicalCountryKey(destination.country)
    if (!deduped.has(key)) {
      deduped.set(key, destination)
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.country.localeCompare(b.country))
}

export function matchAdvisoryByCountry(
  inputCountry: string,
  destinations: AdvisoryDestination[],
): { advisory: AdvisoryDestination | null, suggestions: string[] } {
  const normalizedInput = canonicalCountryKey(inputCountry)
  const byCountry = new Map<string, AdvisoryDestination>()

  for (const destination of destinations) {
    byCountry.set(canonicalCountryKey(destination.country), destination)
  }

  const directMatch = byCountry.get(normalizedInput)
  if (directMatch) {
    return { advisory: directMatch, suggestions: [] }
  }

  const tokens = normalizedInput.split(' ').filter(Boolean)
  const suggestions = destinations
    .filter((destination) => {
      const key = canonicalCountryKey(destination.country)
      return tokens.every((token) => key.includes(token))
    })
    .slice(0, 5)
    .map((destination) => destination.country)

  return { advisory: null, suggestions }
}

function parseRow(row: Record<string, unknown>): AdvisoryDestination | null {
  const country = pickString(row, [
    'country',
    'title',
    'name',
    'destination',
    'destination_name',
  ])

  if (!country) {
    return null
  }

  const adviceText = pickString(row, [
    'advice_level',
    'adviceLevel',
    'advice',
    'advice_text_level',
    'field_overall_advice_level',
    'field_advice_level',
  ])

  const adviceLevel = resolveAdviceLevel(row, adviceText)
  if (!adviceLevel) {
    return null
  }

  const summary = pickString(row, [
    'advice_text',
    'adviceText',
    'advice_summary',
    'summary',
    'overall_advice',
    'field_last_update_notes',
    'field_last_update',
  ]) ?? LEVEL_LABELS[adviceLevel]

  const updatedAt = parseIsoDate(
    pickString(row, [
      'date',
      'updated',
      'updated_at',
      'updatedAt',
      'last_updated',
      'lastUpdated',
      'changed',
    ]),
  )

  const sourceUrl = resolveSourceUrl(
    pickString(row, ['url', 'link', 'source_url', 'destination_url', 'field_url']),
  )

  return {
    country: country.trim(),
    adviceLevel,
    adviceLabel: LEVEL_LABELS[adviceLevel],
    summary: sanitizeText(summary),
    updatedAt,
    sourceUrl,
    regionalAdvisories: extractRegionalAdvisories(row),
  }
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord)
  }

  if (!isRecord(payload)) {
    return []
  }

  for (const key of ['destinations', 'data', 'items', 'results']) {
    const value = payload[key]
    if (Array.isArray(value)) {
      return value.filter(isRecord)
    }
  }

  const values = Object.values(payload)
  if (values.every(isRecord)) {
    return values
  }

  return []
}

function resolveAdviceLevel(
  row: Record<string, unknown>,
  adviceText: string | null,
): AdviceLevel | null {
  const numericLevel = pickNumber(row, ['advice_level_id', 'adviceLevelId', 'level', 'level_id'])
  if (numericLevel && numericLevel >= 1 && numericLevel <= 4) {
    return numericLevel as AdviceLevel
  }

  if (adviceText) {
    for (const { level, pattern } of LEVEL_PATTERNS) {
      if (pattern.test(adviceText)) {
        return level
      }
    }
  }

  return null
}

function extractRegionalAdvisories(row: Record<string, unknown>): string[] {
  const raw = row.regional_advisories
    ?? row.regionalAdvisories
    ?? row.regions
    ?? row.regional_advice
    ?? row.field_advice_levels

  if (!raw) return []

  if (Array.isArray(raw)) {
    const messages = raw
      .map((item) => {
        if (typeof item === 'string') return sanitizeText(item)
        if (!isRecord(item)) return null
        return pickString(item, ['advice_text', 'advice', 'summary', 'title'])
      })
      .filter((value): value is string => Boolean(value && value.trim()))
      .map(sanitizeText)

    return Array.from(new Set(messages))
  }

  if (typeof raw === 'string' && raw.trim()) {
    return [sanitizeText(raw)]
  }

  return []
}

function resolveSourceUrl(rawUrl: string | null): string {
  if (!rawUrl) return SOURCE_ORIGIN
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl
  if (rawUrl.startsWith('/')) return `${SOURCE_ORIGIN}${rawUrl}`
  return `${SOURCE_ORIGIN}/${rawUrl}`
}

function parseIsoDate(value: string | null): string {
  if (!value) return new Date(0).toISOString()
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return new Date(0).toISOString()
  }
  return new Date(timestamp).toISOString()
}

function sanitizeText(value: string): string {
  const withoutTags = value
    .replace(/<[^>]+>/g, ' ')

  return decodeHtmlEntities(withoutTags)
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const codePoint = Number(dec)
      if (!Number.isFinite(codePoint)) return _m
      return safeFromCodePoint(codePoint, _m)
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => {
      const codePoint = Number.parseInt(hex, 16)
      if (!Number.isFinite(codePoint)) return _m
      return safeFromCodePoint(codePoint, _m)
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&(apos|#39);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function safeFromCodePoint(codePoint: number, fallback: string): string {
  try {
    return String.fromCodePoint(codePoint)
  } catch {
    return fallback
  }
}

function pickString(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function pickNumber(
  row: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
