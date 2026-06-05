import type { SoulProfile, CityWithEnergy, Planet, LineType, TripIntent } from '../types/index'
import { CITY_INTENT_TAGS } from '../data/cityIntentTags'
import { getBundledTravelAdvisory } from './travelAdvisory'

interface PlanetInfluence {
  planet: Planet
  lineType: LineType
  weight: number
}

interface NumerologyNeeds {
  theme: string
  description: string
  influences: PlanetInfluence[]
}

export interface TripIntentProfile {
  id: TripIntent
  label: string
  shortLabel: string
  description: string
  tags: string[]
  exampleRegions: string[]
}

export interface RankedCity {
  city: CityWithEnergy
  score: number
  vibeFitScore: number
  goalAlignment: number
  energyAlignment: number
  tripIntentAlignment: number
  safetyAlignment: number
  practicalityAlignment: number
  reason: string
  practicalReason: string
  advisoryLevel: 1 | 2 | 3 | 4 | null
  recommendationTier: 'recommended' | 'caution' | 'notRecommended'
  matchingInfluences: { planet: Planet; lineType: LineType; label: string }[]
  isTopEnergyPick: boolean
}

interface ScoredCandidate {
  city: CityWithEnergy
  score: number
  matchingInfluences: { planet: Planet; lineType: LineType; label: string }[]
  normNumerology: number
  normEnergy: number
  tripIntentAlignment: number
  safetyAlignment: number
  practicalityAlignment: number
  advisoryLevel: 1 | 2 | 3 | 4 | null
  recommendationTier: 'recommended' | 'caution' | 'notRecommended'
  practicalReason: string
}

const REGIONAL_CLUSTER_KM = 350
const MIN_VISIBLE_ENERGY = 0.01

export const TRIP_INTENT_PROFILES: TripIntentProfile[] = [
  {
    id: 'open',
    label: 'Open to anything',
    shortLabel: 'Open',
    description: 'Balanced recommendations that keep travel practicality ahead of raw alignment.',
    tags: ['wellness', 'culture', 'nature', 'food', 'creative', 'city'],
    exampleRegions: ['Portugal', 'Japan', 'Vietnam'],
  },
  {
    id: 'adventure',
    label: 'Adventure and fun',
    shortLabel: 'Adventure',
    description: 'Movement, discovery, nature, nightlife, and memorable activities.',
    tags: ['adventure', 'nature', 'nightlife', 'food', 'city'],
    exampleRegions: ['Vietnam', 'Costa Rica', 'New Zealand'],
  },
  {
    id: 'spirituality',
    label: 'Spirituality',
    shortLabel: 'Spiritual',
    description: 'Temples, retreats, ritual, reflection, and places with contemplative texture.',
    tags: ['spirituality', 'wellness', 'retreat', 'nature'],
    exampleRegions: ['Bali', 'Nepal', 'Japan'],
  },
  {
    id: 'surf',
    label: 'Surf and coast',
    shortLabel: 'Surf',
    description: 'Coastline, water, easygoing towns, and outdoor rhythm.',
    tags: ['surf', 'coast', 'adventure', 'nature'],
    exampleRegions: ['Sri Lanka', 'Bali', 'Portugal'],
  },
  {
    id: 'romance',
    label: 'Romance',
    shortLabel: 'Romance',
    description: 'Beauty, intimacy, slower travel, food, art, and partnership energy.',
    tags: ['romance', 'food', 'culture', 'wellness'],
    exampleRegions: ['Italy', 'France', 'Greece'],
  },
  {
    id: 'reset',
    label: 'Reset and wellness',
    shortLabel: 'Reset',
    description: 'Restorative places for health, quiet, softness, and nervous-system repair.',
    tags: ['wellness', 'retreat', 'nature', 'spirituality'],
    exampleRegions: ['Indonesia', 'Thailand', 'Portugal'],
  },
  {
    id: 'culture',
    label: 'Culture and food',
    shortLabel: 'Culture',
    description: 'Cities with strong food, art, history, and social texture.',
    tags: ['culture', 'food', 'city', 'creative'],
    exampleRegions: ['Japan', 'Mexico', 'Spain'],
  },
  {
    id: 'career',
    label: 'Career and momentum',
    shortLabel: 'Career',
    description: 'Places for visibility, ambition, networking, and practical opportunity.',
    tags: ['career', 'city', 'creative', 'food'],
    exampleRegions: ['Singapore', 'United States', 'United Kingdom'],
  },
]

const PROFILE_BY_INTENT = new Map(TRIP_INTENT_PROFILES.map((profile) => [profile.id, profile]))

function cityKey(city: CityWithEnergy): string {
  return `${city.name}|${city.country}`
}

function normalizedKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizedCityKey(city: CityWithEnergy): string {
  return `${normalizedKey(city.name)}|${normalizedKey(city.country)}`
}

function cityTags(city: CityWithEnergy): string[] {
  return CITY_INTENT_TAGS[normalizedCityKey(city)] ?? []
}

function getIntentProfile(intent: TripIntent): TripIntentProfile {
  return PROFILE_BY_INTENT.get(intent) ?? TRIP_INTENT_PROFILES[0]
}

function getTripIntentAlignment(city: CityWithEnergy, intent: TripIntent): number {
  if (intent === 'open') return 0.82

  const profile = getIntentProfile(intent)
  const wanted = new Set(profile.tags)
  const tags = new Set(cityTags(city))
  const requiredTags: Partial<Record<TripIntent, string[]>> = {
    spirituality: ['spirituality', 'retreat', 'wellness'],
    surf: ['surf'],
    romance: ['romance'],
    reset: ['wellness', 'retreat', 'spirituality'],
    culture: ['culture', 'food'],
    career: ['career', 'city'],
  }
  const required = requiredTags[intent]
  if (required && !required.some((tag) => tags.has(tag))) return 0.42

  let matches = 0
  for (const tag of tags) {
    if (wanted.has(tag)) matches++
  }

  if (matches >= 3) return 1
  if (matches === 2) return 0.86
  if (matches === 1) return 0.7
  return 0.42
}

function getSafetySuitability(city: CityWithEnergy): {
  advisoryLevel: 1 | 2 | 3 | 4 | null
  safetyAlignment: number
  recommendationTier: 'recommended' | 'caution' | 'notRecommended'
  practicalReason: string
} {
  const advisory = getBundledTravelAdvisory(city.country)
  if (advisory.status !== 'ok') {
    return {
      advisoryLevel: null,
      safetyAlignment: 0.62,
      recommendationTier: 'caution',
      practicalReason: 'Travel advisory was not matched, so this stays below verified options.',
    }
  }

  switch (advisory.advisory.adviceLevel) {
    case 1:
      return {
        advisoryLevel: 1,
        safetyAlignment: 1,
        recommendationTier: 'recommended',
        practicalReason: 'Normal travel-advisory level supports this as a practical recommendation.',
      }
    case 2:
      return {
        advisoryLevel: 2,
        safetyAlignment: 0.82,
        recommendationTier: 'caution',
        practicalReason: 'Good match, with a caution badge because the advisory asks for extra care.',
      }
    case 3:
      return {
        advisoryLevel: 3,
        safetyAlignment: 0.18,
        recommendationTier: 'notRecommended',
        practicalReason: 'Strong alignment, but not a default trip recommendation while advice is reconsider travel.',
      }
    case 4:
      return {
        advisoryLevel: 4,
        safetyAlignment: 0.04,
        recommendationTier: 'notRecommended',
        practicalReason: 'Strong alignment only. The current advisory says do not travel, so it is kept out of recommended picks.',
      }
    default:
      return {
        advisoryLevel: null,
        safetyAlignment: 0.62,
        recommendationTier: 'caution',
        practicalReason: 'Travel advisory was not matched, so this stays below verified options.',
      }
  }
}

function practicalityAlignment(city: CityWithEnergy, intent: TripIntent): number {
  const tags = new Set(cityTags(city))
  if (tags.size === 0) return intent === 'open' ? 0.62 : 0.48
  if (tags.has('city') || tags.has('food') || tags.has('culture') || tags.has('wellness')) return 0.9
  return 0.76
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
    description: 'Adventure calls - seek destinations that shake up routines and expand your world.',
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
    description: 'Nurturing energy awaits - find places that center love, family, and home.',
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
    description: 'Go inward - seek places for solitude, spiritual study, and deep knowing.',
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
    description: 'Step into authority - find locations where ambition meets opportunity.',
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
    description: 'Close the cycle - places for release, healing, and preparing for rebirth.',
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
    description: 'Master number energy - seek places that awaken intuition and spiritual vision.',
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
    description: 'Master number energy - manifest visionary projects in places of grounded power.',
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
    description: 'Master number energy - seek places where compassion heals and wisdom uplifts.',
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
  tripIntent: TripIntent = 'open',
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
      const seen = new Set<string>()
      const uniqueLines = city.activeLines.filter((l) => {
        const key = `${l.planet}-${l.lineType}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

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

      const maxNumerology = needs.influences[0]?.weight ?? 1
      const normNumerology = maxNumerology > 0 ? Math.min(1, numerologyScore / maxNumerology) : 0
      const normEnergy = city.energyScore / maxEnergy
      const score = normNumerology * 0.6 + normEnergy * 0.4
      const tripIntentAlignment = getTripIntentAlignment(city, tripIntent)
      const safety = getSafetySuitability(city)
      const practicality = practicalityAlignment(city, tripIntent)
      const vibeFitScore = score
        * (0.48 + tripIntentAlignment * 0.52)
        * (0.5 + practicality * 0.5)
        * safety.safetyAlignment

      return {
        city,
        score: vibeFitScore,
        matchingInfluences,
        normNumerology,
        normEnergy,
        tripIntentAlignment,
        safetyAlignment: safety.safetyAlignment,
        practicalityAlignment: practicality,
        advisoryLevel: safety.advisoryLevel,
        recommendationTier: safety.recommendationTier,
        practicalReason: safety.practicalReason,
      }
    })
    .filter((candidate) => candidate.normEnergy >= MIN_VISIBLE_ENERGY)
    .sort((a, b) => b.score - a.score)

  const popRank = populationRankMap(cities)
  const recommendable = scored.filter((candidate) => candidate.recommendationTier !== 'notRecommended')
  const intentMatched = tripIntent === 'open'
    ? recommendable
    : recommendable.filter((candidate) => candidate.tripIntentAlignment > 0.5)
  const primaryPool = intentMatched.length > 0 ? intentMatched : recommendable
  const fillPool = tripIntent === 'open' ? recommendable : primaryPool
  const regionalCandidates = pickRegionalRepresentatives(primaryPool, popRank)
  const topEnergyCount = Math.min(3, limit)
  const topEnergy = [...regionalCandidates]
    .sort((a, b) => b.score - a.score)
    .slice(0, topEnergyCount)
  const topEnergyKeys = new Set(topEnergy.map((s) => cityKey(s.city)))
  const hasPeakEnergyCities = topEnergy.some((s) => s.normEnergy >= 0.95)

  const recommended: ScoredCandidate[] = []
  const included = new Set<string>()

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

  for (const candidate of fillPool) {
    if (recommended.length >= limit) break
    const key = cityKey(candidate.city)
    if (included.has(key)) continue
    included.add(key)
    recommended.push(candidate)
  }

  if (recommended.length === 0) {
    for (const candidate of scored) {
      if (recommended.length >= limit) break
      const key = cityKey(candidate.city)
      if (included.has(key)) continue
      included.add(key)
      recommended.push(candidate)
    }
  }

  const ordered = [...recommended].sort((a, b) => b.score - a.score || b.normEnergy - a.normEnergy)

  return ordered.map((candidate) => {
    const {
      city,
      score,
      matchingInfluences,
      normNumerology,
      normEnergy,
      tripIntentAlignment,
      safetyAlignment,
      practicalityAlignment: practicalFit,
      advisoryLevel,
      recommendationTier,
      practicalReason,
    } = candidate
    const key = cityKey(city)
    const isTopEnergyPick = topEnergyKeys.has(key)
    let reason: string
    if (matchingInfluences.length >= 2) {
      reason = `${getIntentProfile(tripIntent).shortLabel} fit with ${matchingInfluences[0].label} and ${matchingInfluences[1].label} supporting your ${needs.theme.toLowerCase()} cycle.`
    } else if (matchingInfluences.length === 1) {
      reason = `${matchingInfluences[0].label} supports your ${needs.theme.toLowerCase()} cycle, with practical fit for this trip intent.`
    } else if (isTopEnergyPick) {
      reason = 'High practical Vibe Fit with strong overall map alignment.'
    } else {
      reason = `Practical destination fit complements your ${needs.theme.toLowerCase()} cycle.`
    }
    return {
      city,
      score,
      vibeFitScore: score,
      goalAlignment: normNumerology,
      energyAlignment: normEnergy,
      tripIntentAlignment,
      safetyAlignment,
      practicalityAlignment: practicalFit,
      reason,
      practicalReason,
      advisoryLevel,
      recommendationTier,
      matchingInfluences,
      isTopEnergyPick,
    }
  })
}

export function scoreCityForTrip(
  city: CityWithEnergy,
  profile: SoulProfile | null,
  tripIntent: TripIntent = 'open',
  maxEnergy = 1,
): number {
  const energy = maxEnergy > 0 ? city.energyScore / maxEnergy : city.energyScore
  const safety = getSafetySuitability(city)
  const intentFit = getTripIntentAlignment(city, tripIntent)
  const practicalFit = practicalityAlignment(city, tripIntent)
  let goalFit = 0

  if (profile) {
    const needs = getNumerologyNeeds(profile)
    const influenceMap = new Map<string, number>()
    for (const inf of needs.influences) influenceMap.set(`${inf.planet}-${inf.lineType}`, inf.weight)

    const seen = new Set<string>()
    let numerologyScore = 0
    for (const line of city.activeLines) {
      const key = `${line.planet}-${line.lineType}`
      if (seen.has(key)) continue
      seen.add(key)
      numerologyScore += influenceMap.get(key) ?? 0
    }
    const maxNumerology = needs.influences[0]?.weight ?? 1
    goalFit = maxNumerology > 0 ? Math.min(1, numerologyScore / maxNumerology) : 0
  }

  const astroFit = goalFit * 0.6 + energy * 0.4
  return astroFit * (0.48 + intentFit * 0.52) * (0.5 + practicalFit * 0.5) * safety.safetyAlignment
}
