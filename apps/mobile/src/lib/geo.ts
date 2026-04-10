import type { AstroLine, City, CityWithEnergy } from '../types/index'
import { getLineDistanceToPoint } from './astrocartography'

const PROXIMITY_THRESHOLD = 3
const BUCKET_SIZE = 10

function lngBucket(lng: number): number {
  return Math.floor(((lng + 180) % 360) / BUCKET_SIZE)
}

function nearbyBuckets(lng: number, range: number): number[] {
  const totalBuckets = 360 / BUCKET_SIZE
  const center = lngBucket(lng)
  const spread = Math.ceil(range / BUCKET_SIZE)
  const buckets: number[] = []
  for (let d = -spread; d <= spread; d++) {
    buckets.push(((center + d) % totalBuckets + totalBuckets) % totalBuckets)
  }
  return buckets
}

export function enrichCitiesWithEnergy(
  cities: City[],
  astroLines: AstroLine[],
): CityWithEnergy[] {
  const totalBuckets = 360 / BUCKET_SIZE
  const lineBuckets: Set<number>[] = Array.from({ length: totalBuckets }, () => new Set())

  for (let li = 0; li < astroLines.length; li++) {
    for (const [lngPt] of astroLines[li].coordinates) {
      lineBuckets[lngBucket(lngPt)].add(li)
    }
  }

  return cities.map((city) => {
    const activeLines: AstroLine[] = []
    let totalWeight = 0

    const candidateIndices = new Set<number>()
    for (const b of nearbyBuckets(city.lng, PROXIMITY_THRESHOLD + 2)) {
      for (const li of lineBuckets[b]) {
        candidateIndices.add(li)
      }
    }

    for (const li of candidateIndices) {
      const line = astroLines[li]
      const dist = getLineDistanceToPoint(line, city.lat, city.lng)
      if (dist < PROXIMITY_THRESHOLD) {
        activeLines.push(line)
        const weight = (1 - dist / PROXIMITY_THRESHOLD) ** 2
        totalWeight += weight
      }
    }

    const energyScore = Math.min(totalWeight / 2, 1)

    return {
      ...city,
      activeLines,
      energyScore,
    }
  })
}

export function declutterCities<T extends CityWithEnergy>(
  cities: T[],
  minDegrees = 3,
  scoreFn: (city: T) => number = (city) => city.energyScore,
): T[] {
  const kept: T[] = []
  const keptScores: number[] = []
  const minSq = minDegrees * minDegrees
  for (const city of cities) {
    const cityScore = scoreFn(city)
    const cosLat = Math.cos((city.lat * Math.PI) / 180)
    let nearbyIndex = -1

    for (let i = 0; i < kept.length; i++) {
      const s = kept[i]
      const dLat = city.lat - s.lat
      const dLng = Math.abs(city.lng - s.lng)
      const wrappedDLng = Math.min(dLng, 360 - dLng) * cosLat
      if (dLat * dLat + wrappedDLng * wrappedDLng < minSq) {
        nearbyIndex = i
        break
      }
    }

    if (nearbyIndex === -1) {
      kept.push(city)
      keptScores.push(cityScore)
      continue
    }

    if (cityScore > keptScores[nearbyIndex]) {
      kept[nearbyIndex] = city
      keptScores[nearbyIndex] = cityScore
    }
  }
  return kept
}
