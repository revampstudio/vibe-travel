import type { SoulProfile } from '../types/index.ts'

function reduceToSingle(n: number): number {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split('').reduce((sum, d) => sum + Number(d), 0)
  }
  return n
}

function digitSum(s: string): number {
  return s.split('').filter(c => /\d/.test(c)).reduce((sum, d) => sum + Number(d), 0)
}

export function calcLifePathNumber(dateStr: string): number {
  const [year, month, day] = dateStr.split('-')
  const m = reduceToSingle(digitSum(month))
  const d = reduceToSingle(digitSum(day))
  const y = reduceToSingle(digitSum(year))
  return reduceToSingle(m + d + y)
}

export function calcPersonalYear(dateStr: string): number {
  const [, month, day] = dateStr.split('-')
  const currentYear = new Date().getFullYear()
  const m = reduceToSingle(digitSum(month))
  const d = reduceToSingle(digitSum(day))
  const y = reduceToSingle(digitSum(String(currentYear)))
  return reduceToSingle(m + d + y)
}

const LIFE_STAGES: Record<number, { name: string; description: string }> = {
  1: {
    name: 'Year of New Beginnings',
    description: 'A powerful year for fresh starts, independence, and planting seeds for the future.',
  },
  2: {
    name: 'Year of Partnership',
    description: 'A year of cooperation, patience, and deepening your most important relationships.',
  },
  3: {
    name: 'Year of Expression',
    description: 'Creativity flows freely. A year to share your voice and embrace joy.',
  },
  4: {
    name: 'Year of Foundation',
    description: 'Time to build structure, discipline, and lay the groundwork for lasting success.',
  },
  5: {
    name: 'Year of Change',
    description: 'Adventure and transformation await. Embrace the unexpected and travel boldly.',
  },
  6: {
    name: 'Year of Harmony',
    description: 'Focus on home, family, and nurturing. Love and responsibility take center stage.',
  },
  7: {
    name: 'Year of Reflection',
    description: 'A deeply spiritual year for introspection, study, and inner wisdom.',
  },
  8: {
    name: 'Year of Power',
    description: 'Abundance and material mastery. Step into your authority and manifest goals.',
  },
  9: {
    name: 'Year of Completion',
    description: 'Release what no longer serves you. A cycle ends, making space for rebirth.',
  },
  11: {
    name: 'Year of Illumination',
    description: 'Master number energy — heightened intuition and spiritual awakening.',
  },
  22: {
    name: 'Year of the Master Builder',
    description: 'Master number energy — enormous potential to manifest visionary projects.',
  },
  33: {
    name: 'Year of the Master Teacher',
    description: 'Master number energy — called to heal and uplift others through compassion.',
  },
}

function getAge(dateStr: string): number {
  const birth = new Date(dateStr)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function isSaturnReturn(age: number): boolean {
  return (age >= 28 && age <= 30) || (age >= 57 && age <= 60)
}

export function calcSoulProfile(dateStr: string): SoulProfile {
  const lifePathNumber = calcLifePathNumber(dateStr)
  const personalYear = calcPersonalYear(dateStr)
  const stage = LIFE_STAGES[personalYear] ?? LIFE_STAGES[personalYear > 9 ? 9 : personalYear]!
  const age = getAge(dateStr)

  return {
    lifePathNumber,
    personalYear,
    lifeStage: stage.name,
    lifeStageDescription: stage.description,
    saturnReturn: isSaturnReturn(age),
    age,
  }
}
