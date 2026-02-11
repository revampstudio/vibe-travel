import type { City } from '../types/index.ts'

let cache: City[] | null = null

export async function loadCities(): Promise<City[]> {
  if (cache) return cache

  const mod = await import('./cities.json')
  const { data } = mod.default as {
    fields: string[]
    data: [string, string, number, number][]
  }

  // fields order: ["name", "country", "lat", "lng"]
  cache = data.map(([name, country, lat, lng]) => ({
    name,
    country,
    lat,
    lng,
  }))

  return cache!
}
