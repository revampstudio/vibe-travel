/**
 * One-time build script: reads SimpleMaps CSV, filters pop >100k,
 * outputs compact array-of-arrays JSON to src/data/cities.json.
 *
 * Usage: npx tsx scripts/build-cities.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CSV_PATH = resolve(import.meta.dirname!, '../data-raw/worldcities.csv')
const OUT_PATH = resolve(import.meta.dirname!, '../src/data/cities.json')

const MIN_POP = 50_000

const raw = readFileSync(CSV_PATH, 'utf-8')
const lines = raw.trim().split('\n')
const header = lines[0].split(',')

const cityIdx = header.indexOf('city')
const latIdx = header.indexOf('lat')
const lngIdx = header.indexOf('lng')
const countryIdx = header.indexOf('country')
const popIdx = header.indexOf('population')

interface Row {
  name: string
  country: string
  lat: number
  lng: number
  pop: number
}

const rows: Row[] = []

for (let i = 1; i < lines.length; i++) {
  // Handle CSV fields that may be quoted
  const cols = lines[i].split(',')
  const pop = Number(cols[popIdx])
  if (Number.isNaN(pop) || pop < MIN_POP) continue

  rows.push({
    name: cols[cityIdx].replace(/^"|"$/g, ''),
    country: cols[countryIdx].replace(/^"|"$/g, ''),
    lat: Math.round(Number(cols[latIdx]) * 10000) / 10000,
    lng: Math.round(Number(cols[lngIdx]) * 10000) / 10000,
    pop,
  })
}

// Add cities missing from SimpleMaps
const missing: Row[] = [
  { name: 'Padua', country: 'Italy', lat: 45.4064, lng: 11.8768, pop: 210000 },
]
for (const m of missing) {
  if (!rows.some(r => r.name === m.name && r.country === m.country)) {
    rows.push(m)
  }
}

// Sort by population descending
rows.sort((a, b) => b.pop - a.pop)

const output = {
  fields: ['name', 'country', 'lat', 'lng'] as const,
  data: rows.map((r) => [r.name, r.country, r.lat, r.lng]),
}

writeFileSync(OUT_PATH, JSON.stringify(output))

console.log(`Wrote ${rows.length} cities to ${OUT_PATH}`)
console.log(`File size: ${(readFileSync(OUT_PATH).length / 1024).toFixed(1)} KB`)
