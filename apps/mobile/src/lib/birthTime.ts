export function parseUtcOffset(value: string): number | null {
  const match = value.trim().match(/^([+-])(\d{2}):(\d{2})$/)
  if (!match) return null
  const minutes = Number(match[2]) * 60 + Number(match[3])
  const result = (match[1] === '-' ? -1 : 1) * minutes
  return Number(match[3]) < 60 && result >= -720 && result <= 840 ? result : null
}
export function formatUtcOffset(value?: number): string {
  if (value === undefined) return ''
  return `${value < 0 ? '-' : '+'}${String(Math.floor(Math.abs(value) / 60)).padStart(2, '0')}:${String(Math.abs(value) % 60).padStart(2, '0')}`
}
