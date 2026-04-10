import type { CityWithEnergy } from '@/src/types'

export function cityKey(city: Pick<CityWithEnergy, 'name' | 'country'>): string {
  return `${city.name}|${city.country}`
}
