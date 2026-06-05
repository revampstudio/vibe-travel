import fs from 'node:fs'

const allowedTags = new Set([
  'wellness',
  'culture',
  'nature',
  'food',
  'creative',
  'city',
  'adventure',
  'nightlife',
  'spirituality',
  'retreat',
  'surf',
  'coast',
  'romance',
  'career',
])

const surfWhitelist = new Set([
  'auckland|new zealand',
  'cape town|south africa',
  'colombo|sri lanka',
  'canggu|indonesia',
  'dakar|senegal',
  'da nang|vietnam',
  'denpasar|indonesia',
  'durban|south africa',
  'florianopolis|brazil',
  'fortaleza|brazil',
  'galle|sri lanka',
  'gold coast|australia',
  'honolulu|united states',
  'jacksonville|united states',
  'lima|peru',
  'lisbon|portugal',
  'los angeles|united states',
  'maceio|brazil',
  'miami|united states',
  'natal|brazil',
  'newcastle|australia',
  'nha trang|vietnam',
  'niteroi|brazil',
  'perth|australia',
  'port elizabeth|south africa',
  'recife|brazil',
  'rio de janeiro|brazil',
  'salvador|brazil',
  'san diego|united states',
  'santa barbara|united states',
  'santa cruz|united states',
  'santos|brazil',
  'sydney|australia',
  'tijuana|mexico',
  'virginia beach|united states',
  'vishakhapatnam|india',
  'vitoria|brazil',
])

function normalizedKey(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

const cities = JSON.parse(fs.readFileSync('apps/mobile/src/data/cities.json', 'utf8')).data
const expectedKeys = new Set(cities.map(([name, country]) => `${normalizedKey(name)}|${normalizedKey(country)}`))
const tagSource = fs.readFileSync('apps/mobile/src/data/cityIntentTags.ts', 'utf8')
const recommendationSource = fs.readFileSync('apps/mobile/src/lib/recommendations.ts', 'utf8')
const tagEntries = [...tagSource.matchAll(/^  "([^"]+)": \[([^\]]*)\],$/gm)]
const actualKeys = new Set()

for (const [, key, body] of tagEntries) {
  if (actualKeys.has(key)) fail(`Duplicate city tag key: ${key}`)
  actualKeys.add(key)

  const tags = [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1])
  if (tags.length < 2 || tags.length > 5) fail(`${key} has ${tags.length} tags`)
  if (new Set(tags).size !== tags.length) fail(`${key} has duplicate tags`)

  for (const tag of tags) {
    if (!allowedTags.has(tag)) fail(`${key} has invalid tag: ${tag}`)
  }

  if (tags.includes('surf') && !surfWhitelist.has(key)) {
    fail(`${key} has surf but is not in the city-level surf whitelist`)
  }
}

for (const key of expectedKeys) {
  if (!actualKeys.has(key)) fail(`Missing city tags for ${key}`)
}

for (const key of actualKeys) {
  if (!expectedKeys.has(key)) fail(`City tag key is not in cities.json: ${key}`)
}

if (/\bCOUNTRY_TAGS\b/.test(recommendationSource) || /\bcountryTags\s*\(/.test(recommendationSource)) {
  fail('recommendations.ts still contains country-level intent tagging')
}

if (!process.exitCode) {
  console.log(`Validated ${actualKeys.size} city-level intent tag entries.`)
}
