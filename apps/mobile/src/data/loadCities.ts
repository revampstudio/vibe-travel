import type { City } from '../types/index'
import citiesDataset from './cities.json'

let cache: City[] | null = null

export async function loadCities(): Promise<City[]> {
  if (cache) return cache

  const { data } = citiesDataset as {
    fields: string[]
    data: [string, string, number, number][]
  }

  cache = data.map(([name, country, lat, lng]) => ({
    name,
    country,
    lat,
    lng,
  }))

  return cache
}
