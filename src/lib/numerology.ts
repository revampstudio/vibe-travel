import type { NumerologyInsights, SoulProfile } from '../types/index.ts'

function reduceToSingle(n: number): number {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split('').reduce((sum, d) => sum + Number(d), 0)
  }
  return n
}

function digitSum(s: string): number {
  return s.split('').filter(c => /\d/.test(c)).reduce((sum, d) => sum + Number(d), 0)
}

const MASTER_NUMBER_BASE: Record<number, number> = {
  11: 2,
  22: 4,
  33: 6,
}

const NUMBER_ESSENCE: Record<number, string> = {
  1: 'leadership, independence, and initiative',
  2: 'partnership, diplomacy, and emotional intelligence',
  3: 'creativity, communication, and joyful expression',
  4: 'discipline, structure, and long-term stability',
  5: 'freedom, adaptability, and reinvention',
  6: 'care, responsibility, and relational harmony',
  7: 'inner work, spiritual depth, and wisdom',
  8: 'ambition, influence, and material mastery',
  9: 'completion, compassion, and release',
  11: 'intuitive sensitivity and inspired vision',
  22: 'master builder focus and practical manifestation',
  33: 'service, healing, and compassionate leadership',
}

const PERSONAL_MONTH_FOCUS: Record<number, string> = {
  1: 'Initiate. Start the task or conversation you have been postponing.',
  2: 'Refine. Collaborate, listen carefully, and avoid forcing outcomes.',
  3: 'Express. Share ideas publicly, create, and reconnect with play.',
  4: 'Stabilize. Build routines, tighten systems, and protect your energy.',
  5: 'Expand. Say yes to movement, novelty, and constructive change.',
  6: 'Nurture. Prioritize home, relationships, and meaningful commitments.',
  7: 'Reflect. Slow down for study, integration, and spiritual clarity.',
  8: 'Execute. Focus on leverage, results, and financial decisions.',
  9: 'Complete. Finish loose ends and release what is no longer aligned.',
  11: 'Tune in. Intuition is heightened, so trust subtle signals.',
  22: 'Build big. Turn a bold idea into a grounded, actionable plan.',
  33: 'Serve. Lead with compassion and support people who need you.',
}

function toBaseCycleNumber(n: number): number {
  return MASTER_NUMBER_BASE[n] ?? reduceToSingle(n)
}

function getNumberEssence(n: number): string {
  return NUMBER_ESSENCE[n] ?? NUMBER_ESSENCE[toBaseCycleNumber(n)] ?? 'purposeful growth and alignment'
}

function getMonthFocus(n: number): string {
  return PERSONAL_MONTH_FOCUS[n] ?? PERSONAL_MONTH_FOCUS[toBaseCycleNumber(n)] ?? 'Stay consistent and follow through.'
}

export function calcLifePathNumber(dateStr: string): number {
  const [year, month, day] = dateStr.split('-')
  const m = reduceToSingle(digitSum(month))
  const d = reduceToSingle(digitSum(day))
  const y = reduceToSingle(digitSum(year))
  return reduceToSingle(m + d + y)
}

export function calcPersonalYear(dateStr: string, targetYear = new Date().getFullYear()): number {
  const [, month, day] = dateStr.split('-')
  const m = reduceToSingle(digitSum(month))
  const d = reduceToSingle(digitSum(day))
  const y = reduceToSingle(digitSum(String(targetYear)))
  return reduceToSingle(m + d + y)
}

export function calcBirthdayNumber(dateStr: string): number {
  const [, , day] = dateStr.split('-')
  return reduceToSingle(digitSum(day))
}

export function calcAttitudeNumber(dateStr: string): number {
  const [, month, day] = dateStr.split('-')
  const monthValue = reduceToSingle(digitSum(month))
  const dayValue = reduceToSingle(digitSum(day))
  return reduceToSingle(monthValue + dayValue)
}

export function calcPersonalMonth(personalYear: number, targetMonth = new Date().getMonth() + 1): number {
  const monthValue = reduceToSingle(digitSum(String(targetMonth)))
  const personalYearValue = reduceToSingle(personalYear)
  return reduceToSingle(monthValue + personalYearValue)
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

function buildNumerologyInsights(dateStr: string, lifePathNumber: number, personalYear: number): NumerologyInsights {
  const currentYear = new Date().getFullYear()
  const birthdayNumber = calcBirthdayNumber(dateStr)
  const attitudeNumber = calcAttitudeNumber(dateStr)
  const personalMonth = calcPersonalMonth(personalYear)
  const nextPersonalYear = calcPersonalYear(dateStr, currentYear + 1)
  const nextStage = LIFE_STAGES[nextPersonalYear] ?? LIFE_STAGES[toBaseCycleNumber(nextPersonalYear)]!

  return {
    lifePathMeaning: `Your default pattern is ${getNumberEssence(lifePathNumber)}.`,
    birthdayNumber,
    birthdayMeaning: `People usually notice ${getNumberEssence(birthdayNumber)} in you quickly.`,
    attitudeNumber,
    attitudeMeaning: `In new situations, you tend to lead with ${getNumberEssence(attitudeNumber)}.`,
    personalMonth,
    personalMonthMeaning: getMonthFocus(personalMonth),
    nextPersonalYear,
    nextLifeStage: nextStage.name,
    nextLifeStageDescription: nextStage.description,
  }
}

export function calcSoulProfile(dateStr: string): SoulProfile {
  const lifePathNumber = calcLifePathNumber(dateStr)
  const personalYear = calcPersonalYear(dateStr)
  const stage = LIFE_STAGES[personalYear] ?? LIFE_STAGES[personalYear > 9 ? 9 : personalYear]!
  const age = getAge(dateStr)
  const insights = buildNumerologyInsights(dateStr, lifePathNumber, personalYear)

  return {
    lifePathNumber,
    personalYear,
    lifeStage: stage.name,
    lifeStageDescription: stage.description,
    saturnReturn: isSaturnReturn(age),
    age,
    insights,
  }
}
