const COUNTRY_ALIAS_MAP: Record<string, string> = {
  'burma': 'myanmar',
  'cabo verde': 'cape verde',
  'cape verde': 'cape verde',
  'congo kinshasa': 'democratic republic of the congo',
  'congo brazzaville': 'republic of the congo',
  'congo democratic republic of': 'democratic republic of the congo',
  'democratic republic of congo': 'democratic republic of the congo',
  'dr congo': 'democratic republic of the congo',
  'drc': 'democratic republic of the congo',
  'republic of congo': 'republic of the congo',
  'cote divoire': "cote d'ivoire",
  'ivory coast': "cote d'ivoire",
  'czechia': 'czech republic',
  'laos': 'lao pdr',
  'russia': 'russian federation',
  'south korea': 'republic of korea',
  'north korea': "democratic people's republic of korea",
  'syria': 'syrian arab republic',
  'turkiye': 'turkey',
  'uae': 'united arab emirates',
  'uk': 'united kingdom',
  'usa': 'united states of america',
  'us': 'united states of america',
  'vatican city': 'holy see',
}

const SPLIT_JOIN_PATTERN = /\band\b/g
const NON_ALNUM_PATTERN = /[^a-z0-9]+/g
const PARENS_CHAR_PATTERN = /[()]/g

export function normalizeCountryName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(PARENS_CHAR_PATTERN, ' ')
    .replace(/&/g, ' and ')
    .replace(SPLIT_JOIN_PATTERN, ' ')
    .toLowerCase()
    .replace(NON_ALNUM_PATTERN, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function canonicalCountryKey(value: string): string {
  const normalized = normalizeCountryName(value)
  return COUNTRY_ALIAS_MAP[normalized] ?? normalized
}
