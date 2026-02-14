import type { SoulProfile, CityWithEnergy, Planet, LineType } from '../types/index.ts'

interface PlanetInfluence {
  planet: Planet
  lineType: LineType
  weight: number // 0-1, how important this combo is for the theme
}

interface NumerologyNeeds {
  theme: string
  description: string
  influences: PlanetInfluence[]
}

export interface RankedCity {
  city: CityWithEnergy
  score: number // 0-1 combined score
  reason: string
  matchingInfluences: { planet: Planet; lineType: LineType; label: string }[]
  isTopEnergyPick: boolean
}

interface ScoredCandidate {
  city: CityWithEnergy
  score: number
  matchingInfluences: { planet: Planet; lineType: LineType; label: string }[]
  normEnergy: number
}

const REGIONAL_CLUSTER_KM = 350
const MIN_VISIBLE_ENERGY = 0.01

function cityKey(city: CityWithEnergy): string {
  return `${city.name}|${city.country}`
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function distanceKm(a: CityWithEnergy, b: CityWithEnergy): number {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function populationRankMap(cities: CityWithEnergy[]): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < cities.length; i++) {
    map.set(cityKey(cities[i]), i)
  }
  return map
}

function pickRegionalRepresentatives(
  candidates: ScoredCandidate[],
  popRank: Map<string, number>,
): ScoredCandidate[] {
  if (candidates.length === 0) return []

  const clusters: ScoredCandidate[][] = []
  const anchors: ScoredCandidate[] = []

  // Build clusters from strongest-energy cities outward so dense areas collapse early.
  const byEnergy = [...candidates].sort((a, b) => b.normEnergy - a.normEnergy)
  for (const candidate of byEnergy) {
    let clusterIndex = -1
    for (let i = 0; i < anchors.length; i++) {
      if (distanceKm(candidate.city, anchors[i].city) <= REGIONAL_CLUSTER_KM) {
        clusterIndex = i
        break
      }
    }

    if (clusterIndex === -1) {
      anchors.push(candidate)
      clusters.push([candidate])
      continue
    }

    clusters[clusterIndex].push(candidate)
  }

  return clusters
    .map((members) => {
      const representative = members.reduce((best, curr) => {
        const bestRank = popRank.get(cityKey(best.city)) ?? Number.MAX_SAFE_INTEGER
        const currRank = popRank.get(cityKey(curr.city)) ?? Number.MAX_SAFE_INTEGER
        if (currRank < bestRank) return curr
        if (currRank === bestRank && curr.score > best.score) return curr
        return best
      })

      const strongestClusterScore = members.reduce(
        (max, member) => (member.score > max ? member.score : max),
        0,
      )

      return { representative, strongestClusterScore }
    })
    .sort((a, b) => b.strongestClusterScore - a.strongestClusterScore)
    .map((cluster) => cluster.representative)
}

const LINE_LABELS: Record<LineType, string> = {
  MC: 'Midheaven',
  IC: 'Imum Coeli',
  ASC: 'Ascendant',
  DSC: 'Descendant',
}

const YEAR_NEEDS: Record<number, { theme: string; description: string; influences: [Planet, LineType, number][] }> = {
  1: {
    theme: 'New Beginnings',
    description: 'You need places that ignite initiative, self-expression, and bold leadership.',
    influences: [
      ['Sun', 'MC', 1.0],
      ['Mars', 'ASC', 0.9],
      ['Sun', 'ASC', 0.85],
      ['Jupiter', 'MC', 0.7],
      ['Mars', 'MC', 0.65],
    ],
  },
  2: {
    theme: 'Partnership',
    description: 'Seek locations that draw meaningful connections, cooperation, and emotional depth.',
    influences: [
      ['Venus', 'DSC', 1.0],
      ['Moon', 'DSC', 0.9],
      ['Jupiter', 'DSC', 0.8],
      ['Venus', 'IC', 0.65],
      ['Moon', 'IC', 0.6],
    ],
  },
  3: {
    theme: 'Expression',
    description: 'Go where creativity flows freely and your voice is amplified.',
    influences: [
      ['Venus', 'MC', 1.0],
      ['Mercury', 'ASC', 0.9],
      ['Sun', 'ASC', 0.8],
      ['Jupiter', 'ASC', 0.7],
      ['Venus', 'ASC', 0.65],
    ],
  },
  4: {
    theme: 'Foundation',
    description: 'Find places that ground you and support disciplined, lasting work.',
    influences: [
      ['Saturn', 'MC', 1.0],
      ['Sun', 'MC', 0.85],
      ['Saturn', 'IC', 0.75],
      ['Mars', 'MC', 0.65],
      ['Jupiter', 'IC', 0.6],
    ],
  },
  5: {
    theme: 'Change',
    description: 'Adventure calls — seek destinations that shake up routines and expand your world.',
    influences: [
      ['Jupiter', 'ASC', 1.0],
      ['Uranus', 'ASC', 0.9],
      ['Mars', 'ASC', 0.8],
      ['Jupiter', 'MC', 0.7],
      ['Sun', 'ASC', 0.6],
    ],
  },
  6: {
    theme: 'Harmony',
    description: 'Nurturing energy awaits — find places that center love, family, and home.',
    influences: [
      ['Venus', 'IC', 1.0],
      ['Moon', 'IC', 0.9],
      ['Venus', 'DSC', 0.8],
      ['Jupiter', 'IC', 0.7],
      ['Moon', 'DSC', 0.6],
    ],
  },
  7: {
    theme: 'Reflection',
    description: 'Go inward — seek places for solitude, spiritual study, and deep knowing.',
    influences: [
      ['Neptune', 'IC', 1.0],
      ['Moon', 'IC', 0.9],
      ['Pluto', 'IC', 0.8],
      ['Neptune', 'ASC', 0.65],
      ['Saturn', 'IC', 0.6],
    ],
  },
  8: {
    theme: 'Power',
    description: 'Step into authority — find locations where ambition meets opportunity.',
    influences: [
      ['Sun', 'MC', 1.0],
      ['Jupiter', 'MC', 0.95],
      ['Pluto', 'MC', 0.85],
      ['Mars', 'MC', 0.75],
      ['Saturn', 'MC', 0.6],
    ],
  },
  9: {
    theme: 'Completion',
    description: 'Close the cycle — places for release, healing, and preparing for rebirth.',
    influences: [
      ['Pluto', 'IC', 1.0],
      ['Neptune', 'IC', 0.9],
      ['Moon', 'IC', 0.8],
      ['Neptune', 'DSC', 0.65],
      ['Pluto', 'DSC', 0.6],
    ],
  },
  11: {
    theme: 'Illumination',
    description: 'Master number energy — seek places that awaken intuition and spiritual vision.',
    influences: [
      ['Neptune', 'ASC', 1.0],
      ['Moon', 'MC', 0.9],
      ['Neptune', 'IC', 0.85],
      ['Uranus', 'ASC', 0.7],
      ['Jupiter', 'ASC', 0.6],
    ],
  },
  22: {
    theme: 'The Master Builder',
    description: 'Master number energy — manifest visionary projects in places of grounded power.',
    influences: [
      ['Saturn', 'MC', 1.0],
      ['Jupiter', 'MC', 0.95],
      ['Sun', 'MC', 0.85],
      ['Pluto', 'MC', 0.7],
      ['Mars', 'MC', 0.6],
    ],
  },
  33: {
    theme: 'The Master Teacher',
    description: 'Master number energy — seek places where compassion heals and wisdom uplifts.',
    influences: [
      ['Neptune', 'DSC', 1.0],
      ['Venus', 'IC', 0.9],
      ['Moon', 'DSC', 0.85],
      ['Jupiter', 'DSC', 0.75],
      ['Neptune', 'IC', 0.65],
    ],
  },
}

export function getNumerologyNeeds(profile: SoulProfile): NumerologyNeeds {
  const base = YEAR_NEEDS[profile.personalYear] ?? YEAR_NEEDS[1]!
  const influences: PlanetInfluence[] = base.influences.map(([planet, lineType, weight]) => ({
    planet,
    lineType,
    weight,
  }))

  // Saturn Return adds extra weight to structure/transformation lines
  if (profile.saturnReturn) {
    const saturnBoosts: [Planet, LineType, number][] = [
      ['Saturn', 'MC', 0.8],
      ['Pluto', 'IC', 0.7],
      ['Saturn', 'ASC', 0.6],
    ]
    for (const [planet, lineType, weight] of saturnBoosts) {
      const existing = influences.find((i) => i.planet === planet && i.lineType === lineType)
      if (existing) {
        existing.weight = Math.min(1, existing.weight + 0.2)
      } else {
        influences.push({ planet, lineType, weight })
      }
    }
  }

  return {
    theme: base.theme,
    description: base.description,
    influences,
  }
}

export function rankCitiesByNumerology(
  cities: CityWithEnergy[],
  profile: SoulProfile,
  limit = 8,
): RankedCity[] {
  const needs = getNumerologyNeeds(profile)
  const influenceMap = new Map<string, number>()
  for (const inf of needs.influences) {
    influenceMap.set(`${inf.planet}-${inf.lineType}`, inf.weight)
  }

  const maxEnergy = cities.reduce((max, c) => Math.max(max, c.energyScore), 0) || 1

  const scored: ScoredCandidate[] = cities
    .filter((c) => c.activeLines.length > 0)
    .map((city) => {
      // Deduplicate lines
      const seen = new Set<string>()
      const uniqueLines = city.activeLines.filter((l) => {
        const key = `${l.planet}-${l.lineType}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      // Find matching influences and sum their weights
      let numerologyScore = 0
      const matchingInfluences: { planet: Planet; lineType: LineType; label: string }[] = []

      for (const line of uniqueLines) {
        const key = `${line.planet}-${line.lineType}`
        const weight = influenceMap.get(key)
        if (weight) {
          numerologyScore += weight
          matchingInfluences.push({
            planet: line.planet,
            lineType: line.lineType,
            label: `${line.planet} on ${LINE_LABELS[line.lineType]}`,
          })
        }
      }

      // Normalize numerology score (max possible is sum of top 2 weights)
      const maxNumerology = needs.influences
        .slice(0, 2)
        .reduce((sum, i) => sum + i.weight, 0)
      const normNumerology = maxNumerology > 0 ? Math.min(1, numerologyScore / maxNumerology) : 0

      // Combined score: 60% numerology relevance, 40% energy alignment
      const normEnergy = city.energyScore / maxEnergy
      const score = normNumerology * 0.6 + normEnergy * 0.4

      return { city, score, matchingInfluences, normEnergy }
    })
    .filter((candidate) => candidate.normEnergy >= MIN_VISIBLE_ENERGY)
    .sort((a, b) => b.score - a.score)

  const popRank = populationRankMap(cities)
  const regionalCandidates = pickRegionalRepresentatives(scored, popRank)
  const topEnergyCount = Math.min(3, limit)
  const topEnergy = [...regionalCandidates]
    .sort((a, b) => b.normEnergy - a.normEnergy)
    .slice(0, topEnergyCount)
  const topEnergyKeys = new Set(topEnergy.map((s) => cityKey(s.city)))
  const hasPeakEnergyCities = topEnergy.some((s) => s.normEnergy >= 0.95)

  const recommended: ScoredCandidate[] = []
  const included = new Set<string>()

  // Always place top raw-energy cities first so users immediately see peak locations.
  for (const candidate of topEnergy) {
    if (recommended.length >= limit) break
    const key = cityKey(candidate.city)
    if (included.has(key)) continue
    included.add(key)
    recommended.push(candidate)
  }

  const primaryLimit = Math.max(0, limit - topEnergyCount)
  let addedPrimary = 0
  for (const candidate of regionalCandidates) {
    if (addedPrimary >= primaryLimit) break
    if (candidate.score <= 0.1) continue
    // If peak-energy cities exist, suppress very low-energy cards from crowding the top.
    if (hasPeakEnergyCities && candidate.normEnergy < 0.55) continue
    const key = cityKey(candidate.city)
    if (included.has(key)) continue
    included.add(key)
    recommended.push(candidate)
    addedPrimary++
  }

  for (const candidate of regionalCandidates) {
    if (recommended.length >= limit) break
    const key = cityKey(candidate.city)
    if (included.has(key)) continue
    included.add(key)
    recommended.push(candidate)
  }

  for (const candidate of scored) {
    if (recommended.length >= limit) break
    const key = cityKey(candidate.city)
    if (included.has(key)) continue
    included.add(key)
    recommended.push(candidate)
  }

  const ordered = [...recommended].sort(
    (a, b) => b.normEnergy - a.normEnergy || b.score - a.score,
  )

  // Generate reason strings
  return ordered.map(({ city, score, matchingInfluences }) => {
    const key = cityKey(city)
    const isTopEnergyPick = topEnergyKeys.has(key)
    let reason: string
    if (matchingInfluences.length >= 2) {
      reason = `Strong ${needs.theme.toLowerCase()} energy — ${matchingInfluences[0].label} and ${matchingInfluences[1].label} align with your year.`
    } else if (matchingInfluences.length === 1) {
      reason = `${matchingInfluences[0].label} supports your ${needs.theme.toLowerCase()} journey this year.`
    } else if (isTopEnergyPick) {
      reason = `Top raw-energy city on your map with strong overall alignment potential.`
    } else {
      reason = `High energy alignment complements your ${needs.theme.toLowerCase()} cycle.`
    }
    return { city, score, reason, matchingInfluences, isTopEnergyPick }
  })
}
