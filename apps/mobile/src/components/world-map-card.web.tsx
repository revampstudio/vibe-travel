import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { declutterCities } from '@/src/lib/geo'
import { ENERGY_TIERS, LINE_TYPE_STYLES } from '@/src/lib/mapGuidance'
import { useStore } from '@/src/store/useStore'
import type { CityWithEnergy } from '@/src/types'
import { colors, fonts, radii } from '@/src/theme'

interface RenderableCity extends CityWithEnergy {
  cityKey: string
  activeLineCount: number
  priorityScore: number
}

type MapboxSource = {
  setData: (data: unknown) => void
}

type MapboxMap = {
  addControl: (control: unknown, position?: string) => void
  addLayer: (layer: unknown) => void
  addSource: (id: string, source: unknown) => void
  flyTo: (options: { center: [number, number]; zoom: number; duration?: number }) => void
  getCanvas: () => HTMLCanvasElement
  getSource: (id: string) => MapboxSource | undefined
  isStyleLoaded: () => boolean
  off: (event: string, layerOrListener: unknown, listener?: unknown) => void
  on: (event: string, layerOrListener: unknown, listener?: unknown) => void
  remove: () => void
}

type MapboxPopup = {
  addTo: (map: MapboxMap) => MapboxPopup
  remove: () => void
  setDOMContent: (node: HTMLElement) => MapboxPopup
  setLngLat: (lngLat: [number, number]) => MapboxPopup
}

type MapboxGlobal = {
  accessToken: string
  AttributionControl: new (options?: Record<string, unknown>) => unknown
  Map: new (options: Record<string, unknown>) => MapboxMap
  NavigationControl: new () => unknown
  Popup: new (options?: Record<string, unknown>) => MapboxPopup
}

declare global {
  interface Window {
    mapboxgl?: MapboxGlobal
  }
}

const MAPBOX_CSS_ID = 'mapbox-gl-css'
const MAPBOX_SCRIPT_ID = 'mapbox-gl-script'
const MAPBOX_CSS_URL = 'https://api.mapbox.com/mapbox-gl-js/v3.21.0/mapbox-gl.css'
const MAPBOX_SCRIPT_URL = 'https://api.mapbox.com/mapbox-gl-js/v3.21.0/mapbox-gl.js'
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? ''
const STANDARD_STYLE = 'mapbox://styles/mapbox/standard'
const CITY_DECLUTTER_DEGREES = 1.8
const MAJOR_CITY_PRIORITY_WINDOW = 1200
const MAJOR_CITY_PRIORITY_WEIGHT = 0.2

function hasValidMapboxToken(token: string | undefined) {
  return Boolean(token && token.trim() && !token.includes('your_token'))
}

function loadMapboxAssets(): Promise<MapboxGlobal> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Mapbox can only load in the browser'))
      return
    }

    if (window.mapboxgl) {
      resolve(window.mapboxgl)
      return
    }

    if (!document.getElementById(MAPBOX_CSS_ID)) {
      const link = document.createElement('link')
      link.id = MAPBOX_CSS_ID
      link.rel = 'stylesheet'
      link.href = MAPBOX_CSS_URL
      document.head.appendChild(link)
    }

    const existingScript = document.getElementById(MAPBOX_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.mapboxgl) resolve(window.mapboxgl)
      })
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Mapbox GL JS')))
      return
    }

    const script = document.createElement('script')
    script.id = MAPBOX_SCRIPT_ID
    script.src = MAPBOX_SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.mapboxgl) {
        resolve(window.mapboxgl)
      } else {
        reject(new Error('Mapbox GL JS loaded without window.mapboxgl'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load Mapbox GL JS'))
    document.head.appendChild(script)
  })
}

function popupNode(city: RenderableCity): HTMLElement {
  const root = document.createElement('div')
  root.style.minWidth = '160px'
  root.style.padding = '2px 4px'
  root.style.fontFamily = '"Inter", system-ui, sans-serif'

  const title = document.createElement('div')
  title.textContent = city.name
  title.style.fontSize = '14px'
  title.style.fontWeight = '700'
  title.style.color = '#1F2430'

  const meta = document.createElement('div')
  meta.textContent = city.country
  meta.style.marginTop = '2px'
  meta.style.fontSize = '12px'
  meta.style.color = '#5F6777'

  const badges = document.createElement('div')
  badges.style.display = 'flex'
  badges.style.flexWrap = 'wrap'
  badges.style.gap = '6px'
  badges.style.marginTop = '8px'

  const energyBadge = document.createElement('span')
  energyBadge.textContent = `Energy ${Math.round(city.energyScore * 100)}%`
  const linesBadge = document.createElement('span')
  linesBadge.textContent = `${city.activeLineCount} lines`

  for (const badge of [energyBadge, linesBadge]) {
    badge.style.display = 'inline-flex'
    badge.style.alignItems = 'center'
    badge.style.borderRadius = '999px'
    badge.style.backgroundColor = '#FFF0F4'
    badge.style.color = '#E31C4B'
    badge.style.fontSize = '11px'
    badge.style.fontWeight = '700'
    badge.style.padding = '4px 8px'
    badges.appendChild(badge)
  }

  root.appendChild(title)
  root.appendChild(meta)
  root.appendChild(badges)

  return root
}

function energyColor(score: number): string {
  const tier = ENERGY_TIERS.find((entry) => score >= entry.min && score < entry.max)
  return tier?.color ?? ENERGY_TIERS[0].color
}

function MapHost({ onReady }: { onReady: (map: MapboxMap) => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const onReadyRef = useRef(onReady)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    let cancelled = false
    let map: MapboxMap | null = null

    if (!hostRef.current || !hasValidMapboxToken(MAPBOX_TOKEN)) return

    void loadMapboxAssets()
      .then((mapboxgl) => {
        if (cancelled || !hostRef.current) return

        mapboxgl.accessToken = MAPBOX_TOKEN
        map = new mapboxgl.Map({
          container: hostRef.current,
          style: STANDARD_STYLE,
          center: [134, -25],
          zoom: 2,
          pitch: 0,
          bearing: 0,
          projection: { name: 'globe' },
          attributionControl: false,
          logoPosition: 'bottom-left',
        })

        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

        onReadyRef.current(map)
      })
      .catch(() => {
        // Keep the shell visible if the assets fail to load.
      })

    return () => {
      cancelled = true
      map?.remove()
    }
  }, [])

  return <div ref={hostRef} style={domStyles.host} />
}

export function WorldMapCard({ onCityPress }: { onCityPress: (city: CityWithEnergy) => void }) {
  const mapRef = useRef<MapboxMap | null>(null)
  const popupRef = useRef<MapboxPopup | null>(null)
  const astroLines = useStore((state) => state.astroLines)
  const cities = useStore((state) => state.cities)
  const enabledPlanets = useStore((state) => state.enabledPlanets)
  const selectedCity = useStore((state) => state.selectedCity)

  const filteredLines = useMemo(
    () => astroLines.filter((line) => enabledPlanets.has(line.planet)),
    [astroLines, enabledPlanets],
  )

  const linesGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: filteredLines.map((line, index) => ({
      type: 'Feature' as const,
      properties: {
        id: index,
        lineType: line.lineType,
        color: line.color,
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: line.coordinates,
      },
    })),
  }), [filteredLines])

  const renderableCities = useMemo(() => {
    const prominence = (sourceRank: number) => (
      (1 - Math.min(sourceRank, MAJOR_CITY_PRIORITY_WINDOW) / MAJOR_CITY_PRIORITY_WINDOW)
      * MAJOR_CITY_PRIORITY_WEIGHT
    )

    const withLines: RenderableCity[] = []
    for (let sourceRank = 0; sourceRank < cities.length; sourceRank += 1) {
      const city = cities[sourceRank]
      const activeLines = city.activeLines.filter((line) => enabledPlanets.has(line.planet))
      if (activeLines.length === 0) continue

      withLines.push({
        ...city,
        activeLines,
        cityKey: `${city.name}|${city.country}`,
        activeLineCount: activeLines.length,
        priorityScore: city.energyScore + prominence(sourceRank),
      })
    }

    withLines.sort((a, b) => b.energyScore - a.energyScore)
    return declutterCities(withLines, CITY_DECLUTTER_DEGREES, (city) => city.priorityScore).slice(0, 90)
  }, [cities, enabledPlanets])

  const visibleCityByKey = useMemo(() => {
    const byKey = new Map<string, RenderableCity>()
    for (const city of renderableCities) byKey.set(city.cityKey, city)
    return byKey
  }, [renderableCities])

  const citiesGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: renderableCities.map((city) => ({
      type: 'Feature' as const,
      id: city.cityKey,
      properties: {
        cityKey: city.cityKey,
        name: city.name,
        country: city.country,
        energyScore: city.energyScore,
        lineCount: city.activeLineCount,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [city.lng, city.lat],
      },
    })),
  }), [renderableCities])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    map.getSource('astro-lines')?.setData(linesGeoJSON)
    map.getSource('cities')?.setData(citiesGeoJSON)
  }, [citiesGeoJSON, linesGeoJSON])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!selectedCity) {
      popupRef.current?.remove()
      return
    }

    map.flyTo({
      center: [selectedCity.lng, selectedCity.lat],
      zoom: 4.8,
      duration: 900,
    })
  }, [selectedCity])

  return (
    <View style={styles.shell}>
      <View style={styles.mapFrame}>
        <MapHost
          onReady={(map) => {
            mapRef.current = map
            popupRef.current = null

            map.on('load', () => {
              map.addSource('astro-lines', {
                type: 'geojson',
                data: linesGeoJSON,
              })
              for (const style of LINE_TYPE_STYLES) {
                map.addLayer({
                  id: `astro-lines-${style.lineType.toLowerCase()}`,
                  type: 'line',
                  source: 'astro-lines',
                  filter: ['==', ['get', 'lineType'], style.lineType],
                  layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                  },
                  paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 2,
                    'line-opacity': 0.72,
                    ...(style.dasharray ? { 'line-dasharray': style.dasharray } : {}),
                  },
                })
              }

              map.addSource('cities', {
                type: 'geojson',
                data: citiesGeoJSON,
              })
              map.addLayer({
                id: 'city-glow',
                type: 'circle',
                source: 'cities',
                paint: {
                  'circle-radius': ['interpolate', ['linear'], ['get', 'lineCount'], 0, 16, 3, 26, 6, 34],
                  'circle-color': [
                    'step',
                    ['get', 'energyScore'],
                    ENERGY_TIERS[0].color,
                    ENERGY_TIERS[1].min,
                    ENERGY_TIERS[1].color,
                    ENERGY_TIERS[2].min,
                    ENERGY_TIERS[2].color,
                    ENERGY_TIERS[3].min,
                    ENERGY_TIERS[3].color,
                  ],
                  'circle-opacity': 0.22,
                  'circle-blur': 1,
                },
              })
              map.addLayer({
                id: 'city-circles',
                type: 'circle',
                source: 'cities',
                paint: {
                  'circle-radius': ['interpolate', ['linear'], ['get', 'lineCount'], 0, 5, 3, 8, 6, 11],
                  'circle-color': [
                    'step',
                    ['get', 'energyScore'],
                    ENERGY_TIERS[0].color,
                    ENERGY_TIERS[1].min,
                    ENERGY_TIERS[1].color,
                    ENERGY_TIERS[2].min,
                    ENERGY_TIERS[2].color,
                    ENERGY_TIERS[3].min,
                    ENERGY_TIERS[3].color,
                  ],
                  'circle-opacity': 0.92,
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 2,
                },
              })
              map.addLayer({
                id: 'city-labels',
                type: 'symbol',
                source: 'cities',
                layout: {
                  'text-field': ['get', 'name'],
                  'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                  'text-size': 11,
                  'text-offset': [0, 1.4],
                  'text-anchor': 'top',
                  'text-allow-overlap': false,
                  'text-optional': true,
                  'symbol-sort-key': ['-', ['get', 'energyScore']],
                },
                paint: {
                  'text-color': '#10203B',
                  'text-halo-color': '#FFFFFF',
                  'text-halo-width': 1.2,
                },
              })

              const handleMouseMove = (event: any) => {
                const feature = (event.features ?? [])[0]
                const key = feature?.properties?.cityKey
                if (typeof key !== 'string') return

                const city = visibleCityByKey.get(key)
                if (!city) return

                map.getCanvas().style.cursor = 'pointer'
                if (!popupRef.current) {
                  const mapboxgl = window.mapboxgl
                  if (!mapboxgl) return
                  popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
                }

                popupRef.current
                  .setLngLat([city.lng, city.lat])
                  .setDOMContent(popupNode(city))
                  .addTo(map)
              }

              const handleMouseLeave = () => {
                map.getCanvas().style.cursor = ''
                popupRef.current?.remove()
              }

              const handleClick = (event: any) => {
                const feature = (event.features ?? [])[0]
                const key = feature?.properties?.cityKey
                if (typeof key !== 'string') return

                const city = visibleCityByKey.get(key)
                if (!city) return

                map.flyTo({
                  center: [city.lng, city.lat],
                  zoom: 4.8,
                  duration: 900,
                })
                onCityPress(city)
              }

              map.on('mousemove', 'city-circles', handleMouseMove)
              map.on('mouseleave', 'city-circles', handleMouseLeave)
              map.on('click', 'city-circles', handleClick)
              map.on('click', 'city-labels', handleClick)
            })
          }}
        />
      </View>

      {renderableCities.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Map loading</Text>
          <Text style={styles.emptyStateBody}>
            Your astrocartography lines and city markers will appear as soon as your profile finishes hydrating.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#081a31',
  },
  mapFrame: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyState: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  emptyStateTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  emptyStateBody: {
    marginTop: 6,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
  },
})

const domStyles = {
  host: {
    width: '100%',
    height: '100%',
  },
}
