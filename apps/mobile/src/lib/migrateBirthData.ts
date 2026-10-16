import type { BirthData } from '../types'
import { resolveBirthTimeZone } from './birthTimeZone'
export function migrateLegacyBirthData(birth: BirthData): { birthData: BirthData; migrated: boolean; needsReview: boolean } {
  if (birth.utcOffsetMinutes !== undefined) return { birthData: birth, migrated: false, needsReview: false }
  // Old versions discarded the unknown-time flag and used noon. Do not assume a stored noon is exact.
  if (!birth.time || birth.timeKnown === false || (birth.timeKnown === undefined && birth.time === '12:00')) return { birthData: birth, migrated: false, needsReview: true }
  const zone = resolveBirthTimeZone(birth.date, birth.time, birth.lat, birth.lng)
  if (zone.status !== 'ready') return { birthData: birth, migrated: false, needsReview: true }
  return { birthData: { ...birth, utcOffsetMinutes: zone.offsetMinutes, timeZone: zone.timeZone, utcOffsetSource: 'automatic' }, migrated: true, needsReview: false }
}
