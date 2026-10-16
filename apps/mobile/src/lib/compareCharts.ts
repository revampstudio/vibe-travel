import type { AstroLine, City, CityWithEnergy } from '../types'
import { enrichCitiesWithEnergy, declutterCities } from './geo'
import { getLineDistanceToPoint } from './astrocartography'
import { getBundledTravelAdvisory } from './travelAdvisory'
export type ComparisonPurpose = 'travel' | 'live'
export interface SharedPlace { city: CityWithEnergy; companion: CityWithEnergy; balance: number }
function purposeScore(city: CityWithEnergy, purpose: ComparisonPurpose): number {
  return Math.max(0, ...city.activeLines.map(line => {
    const distance = getLineDistanceToPoint(line, city.lat, city.lng)
    const weight = purpose === 'live' ? (line.lineType === 'IC' ? 1.5 : line.lineType === 'DSC' ? 1.15 : 0.8) : (line.lineType === 'ASC' || line.lineType === 'DSC' ? 1.3 : 1)
    return Math.max(0, 1 - distance / 3) * weight
  }))
}
export function compareCharts(source: City[], own: AstroLine[], companion: AstroLine[], purpose: ComparisonPurpose): SharedPlace[] {
  const a = enrichCitiesWithEnergy(source, own)
  const b = enrichCitiesWithEnergy(source, companion)
  const ranked = a.map((city, index) => ({ city, companion: b[index], balance: Math.min(purposeScore(city, purpose), purposeScore(b[index], purpose)) }))
    .filter(item => {
      const advisory = getBundledTravelAdvisory(item.city.country)
      return item.balance > 0 && !(advisory.status === 'ok' && advisory.advisory.adviceLevel >= 3)
    })
    .sort((x, y) => y.balance - x.balance || x.city.name.localeCompare(y.city.name) || x.city.country.localeCompare(y.city.country))
  const byCity = new Map(ranked.map(item => [`${item.city.name}|${item.city.country}`, item]))
  return declutterCities(ranked.map(item => item.city), 4, city => byCity.get(`${city.name}|${city.country}`)!.balance).slice(0, 8).map(city => byCity.get(`${city.name}|${city.country}`)!)
}
export function distinctLines(lines: AstroLine[]): AstroLine[] {
  return lines.filter((line, i) => lines.findIndex(other => other.planet === line.planet && other.lineType === line.lineType) === i)
}
