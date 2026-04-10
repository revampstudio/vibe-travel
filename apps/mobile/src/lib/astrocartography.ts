import * as Astronomy from 'astronomy-engine'
import type { Planet, LineType, AstroLine } from '../types/index'

const PLANET_COLORS: Record<Planet, string> = {
  Sun: '#fdcb6e',
  Moon: '#78909C',
  Mercury: '#00cec9',
  Venus: '#e84393',
  Mars: '#d63031',
  Jupiter: '#6c5ce7',
  Saturn: '#A67C52',
  Uranus: '#74b9ff',
  Neptune: '#a29bfe',
  Pluto: '#2d3436',
}

const PLANET_BODIES: Record<string, Astronomy.Body> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluto: Astronomy.Body.Pluto,
}

const PLANETS: Planet[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']

function normalizeLng(lng: number): number {
  while (lng > 180) lng -= 360
  while (lng < -180) lng += 360
  return lng
}

function degToRad(d: number): number {
  return (d * Math.PI) / 180
}

function radToDeg(r: number): number {
  return (r * 180) / Math.PI
}

interface PlanetPosition {
  ra: number
  dec: number
}

function getPlanetPosition(planet: Planet, date: Date): PlanetPosition {
  const body = PLANET_BODIES[planet]
  const astroDate = Astronomy.MakeTime(date)
  const observer = new Astronomy.Observer(0, 0, 0)
  const equ = Astronomy.Equator(body, astroDate, observer, true, true)
  return {
    ra: equ.ra * 15,
    dec: equ.dec,
  }
}

function getGST(date: Date): number {
  const astroDate = Astronomy.MakeTime(date)
  return Astronomy.SiderealTime(astroDate) * 15
}

function computeMCLine(ra: number, gst: number): [number, number][] {
  const mcLng = normalizeLng(ra - gst)
  const points: [number, number][] = []
  for (let lat = -80; lat <= 80; lat += 2) {
    points.push([normalizeLng(mcLng), lat])
  }
  return points
}

function computeICLine(ra: number, gst: number): [number, number][] {
  const icLng = normalizeLng(ra - gst + 180)
  const points: [number, number][] = []
  for (let lat = -80; lat <= 80; lat += 2) {
    points.push([normalizeLng(icLng), lat])
  }
  return points
}

function computeASCLine(ra: number, dec: number, gst: number): [number, number][] {
  const points: [number, number][] = []
  const decRad = degToRad(dec)
  for (let lat = -65; lat <= 65; lat += 1.5) {
    const latRad = degToRad(lat)
    const tanProduct = Math.tan(latRad) * Math.tan(decRad)
    if (Math.abs(tanProduct) >= 1) continue
    const H = radToDeg(Math.acos(-tanProduct))
    const lng = normalizeLng(ra - gst - H)
    points.push([lng, lat])
  }
  return points
}

function computeDSCLine(ra: number, dec: number, gst: number): [number, number][] {
  const points: [number, number][] = []
  const decRad = degToRad(dec)
  for (let lat = -65; lat <= 65; lat += 1.5) {
    const latRad = degToRad(lat)
    const tanProduct = Math.tan(latRad) * Math.tan(decRad)
    if (Math.abs(tanProduct) >= 1) continue
    const H = radToDeg(Math.acos(-tanProduct))
    const lng = normalizeLng(ra - gst + H)
    points.push([lng, lat])
  }
  return points
}

function splitLineAtAntimeridian(coords: [number, number][]): [number, number][][] {
  if (coords.length < 2) return [coords]

  const segments: [number, number][][] = []
  let current: [number, number][] = [coords[0]]

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]
    const curr = coords[i]
    const diff = Math.abs(curr[0] - prev[0])

    if (diff > 180) {
      segments.push(current)
      current = [curr]
    } else {
      current.push(curr)
    }
  }

  if (current.length > 0) segments.push(current)
  return segments.filter((s) => s.length >= 2)
}

export function computeAstroLines(birthDate: string, birthTime: string): AstroLine[] {
  const [year, month, day] = birthDate.split('-').map(Number)
  const [hour, minute] = birthTime.split(':').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute))

  const gst = getGST(date)
  const lines: AstroLine[] = []
  const lineTypes: LineType[] = ['MC', 'IC', 'ASC', 'DSC']

  for (const planet of PLANETS) {
    const pos = getPlanetPosition(planet, date)

    const rawLines: Record<LineType, [number, number][]> = {
      MC: computeMCLine(pos.ra, gst),
      IC: computeICLine(pos.ra, gst),
      ASC: computeASCLine(pos.ra, pos.dec, gst),
      DSC: computeDSCLine(pos.ra, pos.dec, gst),
    }

    for (const lt of lineTypes) {
      const raw = rawLines[lt]
      if (raw.length < 2) continue

      const segments = splitLineAtAntimeridian(raw)
      for (const seg of segments) {
        lines.push({
          planet,
          lineType: lt,
          coordinates: seg,
          color: PLANET_COLORS[planet],
        })
      }
    }
  }

  return lines
}

export function getLineDistanceToPoint(
  line: AstroLine,
  lat: number,
  lng: number,
): number {
  const cosLat = Math.cos(degToRad(lat))
  let minDist = Infinity
  for (const [lnPt, ltPt] of line.coordinates) {
    const dLat = ltPt - lat
    const dLng = lnPt - lng
    const wrappedDLng = Math.min(Math.abs(dLng), 360 - Math.abs(dLng)) * cosLat
    const dist = Math.sqrt(dLat * dLat + wrappedDLng * wrappedDLng)
    if (dist < minDist) minDist = dist
  }
  return minDist
}

export { PLANET_COLORS, PLANETS }
