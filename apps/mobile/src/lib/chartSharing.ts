import { computeChartGeometry, linesFromGeometry, type ChartGeometry } from './astrocartography'
import type { BirthData } from '../types'

export interface SharedChart { version: 1; geometry: ChartGeometry; approximate: boolean }
// A compact numeric payload works without a server, account, Buffer or browser-only APIs.
export function createSharedChart(birth: BirthData): SharedChart {
  return { version: 1, geometry: computeChartGeometry(birth.date, birth.time, birth.utcOffsetMinutes), approximate: birth.timeKnown === false || birth.utcOffsetMinutes === undefined }
}
export function encodeChart(chart: SharedChart): string {
  return `VTM1:${chart.approximate ? 1 : 0}:` + chart.geometry.flat().map(n => n.toFixed(6)).join(',')
}
export function decodeChart(input: string): SharedChart {
  if (input.length > 5000) throw new Error('This chart code is too long. Paste one Vibe Travel chart code.')
  const token = input.trim().match(/(?:^|\s)(VTM1:[^\s]+)/)?.[1]
  const match = token?.match(/^VTM1:([01]):(.+)$/)
  if (!match) throw new Error('Paste a complete VTM1 chart code shared from Vibe Travel.')
  const fields = match[2].split(',')
  if (fields.some(field => !/^-?\d{1,3}\.\d{6}$/.test(field))) throw new Error('This chart code is incomplete or invalid. Ask your friend to share it again.')
  const values = fields.map(Number)
  if (values.length !== 20 || values.some((n, i) => !Number.isFinite(n) || Math.abs(n) > (i % 2 ? 90 : 180))) throw new Error('This chart code is incomplete or invalid. Ask your friend to share it again.')
  const geometry: ChartGeometry = Array.from({ length: 10 }, (_, i) => [values[i * 2], values[i * 2 + 1]])
  return { version: 1, geometry, approximate: match[1] === '1' }
}
export function sharedChartLines(chart: SharedChart) { return linesFromGeometry(chart.geometry) }
export function chartShareMessage(chart: SharedChart): string {
  return `Here is my Vibe Travel astrocartography map. Open Share & compare in Vibe Travel and paste this code to explore it or overlay our maps.\n\n${encodeChart(chart)}\n\nThis contains planetary map positions, not my name or birth date, time or city. Treat the chart as personal information. Astrology is for reflection; it does not predict compatibility or outcomes.`
}
