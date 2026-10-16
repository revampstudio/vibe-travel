import tzLookup from 'tz-lookup'
import { Temporal } from '@js-temporal/polyfill'
import { birthInstant } from './astrocartography'
export type TimeZoneResolution =
  | { status: 'ready'; timeZone: string; offset: string; offsetMinutes: number }
  | { status: 'ambiguous'; timeZone: string; choices: { offset: string; offsetMinutes: number }[]; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'pending' }
export function resolveBirthTimeZone(date: string, time: string, lat?: number, lng?: number): TimeZoneResolution {
  if (!date || !time || lat === undefined || lng === undefined) return { status: 'pending' }
  try { birthInstant(date, time) } catch { return { status: 'invalid', message: 'Check the birth date and local time.' } }
  try {
    const timeZone = tzLookup(lat, lng)
    const local = Temporal.PlainDateTime.from(`${date}T${time}:00`)
    const earlier = local.toZonedDateTime(timeZone, { disambiguation: 'earlier' })
    const later = local.toZonedDateTime(timeZone, { disambiguation: 'later' })
    if (!earlier.toPlainDateTime().equals(local) || !later.toPlainDateTime().equals(local)) {
      return { status: 'invalid', message: 'That local clock time did not exist because the clocks changed. Please check the birth record and enter the recorded local time.' }
    }
    if (earlier.epochMilliseconds !== later.epochMilliseconds) {
      return { status: 'ambiguous', timeZone, choices: [earlier, later].map(value => ({ offset: value.offset, offsetMinutes: value.offsetNanoseconds / 60e9 })), message: 'The clocks moved back and this local time occurred twice. Choose the offset shown on the birth record, or check which occurrence was recorded.' }
    }
    return { status: 'ready', timeZone, offset: earlier.offset, offsetMinutes: earlier.offsetNanoseconds / 60e9 }
  } catch {
    return { status: 'unavailable', message: 'We could not resolve this historical time zone. Check the selected city, or use the advanced offset if you know it.' }
  }
}
