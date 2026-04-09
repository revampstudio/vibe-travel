import { useRef, useCallback, useMemo, useEffect, useState } from 'react'
import MapboxMap, { Source, Layer, Popup, AttributionControl } from 'react-map-gl/mapbox'
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox'
import type { LayerSpecification, MapboxGeoJSONFeature } from 'mapbox-gl'
import { useStore } from '../store/useStore.ts'
import { declutterCities } from '../lib/geo.ts'
import type { CityWithEnergy } from '../types/index.ts'
import { ENERGY_TIERS, LINE_TYPE_STYLES } from '../lib/mapGuidance.ts'

interface HoveredCity {
  name: string
  country: string
  lng: number
  lat: number
  energyScore: number
  lineCount: number
}

interface RenderableCity extends CityWithEnergy {
  cityKey: string
  sourceRank: number
  activeLineCount: number
  priorityScore: number
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

const MAPBOX_PLACEHOLDER_TOKENS = new Set([
  '',
  'undefined',
  'null',
  'your_mapbox_token_here',
  'your_mapbox_token',
  '<your_mapbox_token_here>',
])

const isMapboxTokenValid = (token: string | undefined) => {
  if (!token) return false
  const normalized = token.trim().toLowerCase()
  if (MAPBOX_PLACEHOLDER_TOKENS.has(normalized)) return false
  return true
}

const STANDARD_STYLE = 'mapbox://styles/mapbox/standard'
const CITY_DECLUTTER_DEGREES = 1.8
const MAJOR_CITY_PRIORITY_WINDOW = 1200
const MAJOR_CITY_PRIORITY_WEIGHT = 0.2
const ENERGY_COLOR_EXPRESSION: unknown[] = [
  'step',
  ['get', 'energyScore'],
  ENERGY_TIERS[0].color,
  ENERGY_TIERS[1].min,
  ENERGY_TIERS[1].color,
  ENERGY_TIERS[2].min,
  ENERGY_TIERS[2].color,
  ENERGY_TIERS[3].min,
  ENERGY_TIERS[3].color,
]

export default function GlobeMap() {
  const mapRef = useRef<MapRef>(null)
  const astroLines = useStore((s) => s.astroLines)
  const cities = useStore((s) => s.cities)
  const enabledPlanets = useStore((s) => s.enabledPlanets)
  const setSelectedCity = useStore((s) => s.setSelectedCity)
  const setView = useStore((s) => s.setView)
  const selectedCity = useStore((s) => s.selectedCity)
  const highlightedCity = useStore((s) => s.highlightedCity)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [hoveredCity, setHoveredCity] = useState<HoveredCity | null>(null)
  const hoveredFeatureIdRef = useRef<string | null>(null)
  const externalHighlightFeatureIdRef = useRef<string | null>(null)
  const hasValidMapboxToken = isMapboxTokenValid(MAPBOX_TOKEN)

  const filteredLines = useMemo(
    () => astroLines.filter((l) => enabledPlanets.has(l.planet)),
    [astroLines, enabledPlanets],
  )

  const linesGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: filteredLines.map((line, i) => ({
      type: 'Feature' as const,
      properties: {
        id: i,
        planet: line.planet,
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
      let activeLineCount = 0
      for (const line of city.activeLines) {
        if (enabledPlanets.has(line.planet)) activeLineCount += 1
      }
      if (activeLineCount === 0) continue
      withLines.push({
        ...city,
        cityKey: `${city.name}|${city.country}`,
        sourceRank,
        activeLineCount,
        priorityScore: city.energyScore + prominence(sourceRank),
      })
    }

    withLines.sort((a, b) => b.energyScore - a.energyScore)
    return declutterCities(
      withLines,
      CITY_DECLUTTER_DEGREES,
      (city) => city.priorityScore,
    )
  }, [cities, enabledPlanets])

  const visibleCityByKey = useMemo(() => {
    const byKey = new Map<string, RenderableCity>()
    for (const city of renderableCities) {
      byKey.set(city.cityKey, city)
    }
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

  const internalClickRef = useRef(false)

  const handleCityClick = useCallback((city: CityWithEnergy) => {
    internalClickRef.current = true
    setSelectedCity(city)
    setView('detail')

    mapRef.current?.flyTo({
      center: [city.lng, city.lat],
      zoom: 9,
      pitch: 45,
      bearing: -20,
      duration: 2500,
      essential: true,
    })
  }, [setSelectedCity, setView])

  // Fly to city when selected externally (e.g. from sidebar)
  useEffect(() => {
    if (selectedCity && mapRef.current && mapLoaded) {
      if (internalClickRef.current) {
        internalClickRef.current = false
        return
      }
      mapRef.current.flyTo({
        center: [selectedCity.lng, selectedCity.lat],
        zoom: 9,
        pitch: 45,
        bearing: -20,
        duration: 2500,
        essential: true,
      })
    }
    if (!selectedCity && mapRef.current && mapLoaded) {
      mapRef.current.flyTo({
        zoom: 2,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      })
    }
  }, [selectedCity, mapLoaded])

  const getCityFeature = useCallback((e: MapMouseEvent): MapboxGeoJSONFeature | null => {
    const features = (e.features ?? []) as MapboxGeoJSONFeature[]
    return (
      features.find((feature) => feature.layer?.id === 'city-circles')
      ?? features.find((feature) => feature.layer?.id === 'city-labels')
      ?? null
    )
  }, [])

  const getFeatureKey = useCallback((feature: MapboxGeoJSONFeature | null): string | null => {
    if (!feature) return null
    if (typeof feature.id === 'string' || typeof feature.id === 'number') {
      return String(feature.id)
    }
    const key = feature.properties?.cityKey
    return typeof key === 'string' ? key : null
  }, [])

  // Sync highlightedCity (from sidebar hover) → Mapbox feature-state
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    const map = mapRef.current.getMap()
    if (!map.getSource('cities')) return

    // Clear previous external highlight
    if (externalHighlightFeatureIdRef.current !== null) {
      map.setFeatureState(
        { source: 'cities', id: externalHighlightFeatureIdRef.current },
        { externallyHighlighted: false },
      )
      externalHighlightFeatureIdRef.current = null
    }

    if (highlightedCity && visibleCityByKey.has(highlightedCity)) {
      externalHighlightFeatureIdRef.current = highlightedCity
      map.setFeatureState(
        { source: 'cities', id: highlightedCity },
        { externallyHighlighted: true },
      )
    }
  }, [highlightedCity, visibleCityByKey, mapLoaded])

  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()

    const feature = getCityFeature(e)
    const featureKey = getFeatureKey(feature)

    if (!featureKey) {
      if (hoveredFeatureIdRef.current !== null) {
        map.setFeatureState(
          { source: 'cities', id: hoveredFeatureIdRef.current },
          { hovered: false },
        )
        hoveredFeatureIdRef.current = null
      }
      setHoveredCity(null)
      return
    }

    if (hoveredFeatureIdRef.current !== featureKey) {
      if (hoveredFeatureIdRef.current !== null) {
        map.setFeatureState(
          { source: 'cities', id: hoveredFeatureIdRef.current },
          { hovered: false },
        )
      }

      hoveredFeatureIdRef.current = featureKey
      map.setFeatureState(
        { source: 'cities', id: featureKey },
        { hovered: true },
      )

      const city = visibleCityByKey.get(featureKey)
      if (city) {
        setHoveredCity({
          name: city.name,
          country: city.country,
          lng: city.lng,
          lat: city.lat,
          energyScore: city.energyScore,
          lineCount: city.activeLineCount,
        })
      }
    }
  }, [getCityFeature, getFeatureKey, visibleCityByKey])

  const handleMouseLeave = useCallback(() => {
    if (hoveredFeatureIdRef.current !== null && mapRef.current) {
      mapRef.current.getMap().setFeatureState(
        { source: 'cities', id: hoveredFeatureIdRef.current },
        { hovered: false },
      )
      hoveredFeatureIdRef.current = null
    }
    setHoveredCity(null)
  }, [])

  const lineLayer = {
    'line-width': [
      'case',
      ['any',
        ['==', ['get', 'planet'], 'Venus'],
        ['==', ['get', 'planet'], 'Jupiter'],
        ['==', ['get', 'planet'], 'Sun'],
      ],
      3.5,
      2.5,
    ],
    'line-opacity': [
      'case',
      ['any',
        ['==', ['get', 'planet'], 'Venus'],
        ['==', ['get', 'planet'], 'Jupiter'],
        ['==', ['get', 'planet'], 'Sun'],
      ],
      0.9,
      0.72,
    ],
  } as const

  const cityGlowLayer = {
    id: 'city-glow',
    type: 'circle',
    source: 'cities',
    slot: 'top',
    paint: {
      'circle-radius': [
        'case',
        ['any',
          ['boolean', ['feature-state', 'hovered'], false],
          ['boolean', ['feature-state', 'externallyHighlighted'], false],
        ],
        ['interpolate', ['linear'], ['get', 'lineCount'],
          0, 28,
          3, 40,
          6, 52,
        ],
        ['interpolate', ['linear'], ['get', 'lineCount'],
          0, 16,
          3, 26,
          6, 36,
        ],
      ],
      'circle-color': ENERGY_COLOR_EXPRESSION,
      'circle-opacity': [
        'case',
        ['any',
          ['boolean', ['feature-state', 'hovered'], false],
          ['boolean', ['feature-state', 'externallyHighlighted'], false],
        ],
        0.4,
        0.2,
      ],
      'circle-blur': 1,
    },
  } as unknown as LayerSpecification

  const cityCircleLayer = {
    id: 'city-circles',
    type: 'circle',
    source: 'cities',
    slot: 'top',
    paint: {
      'circle-radius': [
        'case',
        ['any',
          ['boolean', ['feature-state', 'hovered'], false],
          ['boolean', ['feature-state', 'externallyHighlighted'], false],
        ],
        ['interpolate', ['linear'], ['get', 'lineCount'],
          0, 8,
          3, 12,
          6, 16,
        ],
        ['interpolate', ['linear'], ['get', 'lineCount'],
          0, 5,
          3, 8,
          6, 11,
        ],
      ],
      'circle-color': ENERGY_COLOR_EXPRESSION,
      'circle-opacity': 0.9,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': [
        'case',
        ['any',
          ['boolean', ['feature-state', 'hovered'], false],
          ['boolean', ['feature-state', 'externallyHighlighted'], false],
        ],
        3,
        2,
      ],
      'circle-stroke-opacity': 1,
    },
  } as unknown as LayerSpecification

  const cityLabelLayer = {
    id: 'city-labels',
    type: 'symbol',
    source: 'cities',
    slot: 'top',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-size': 12,
      'text-offset': [0, 1.8],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'icon-allow-overlap': true,
      'text-optional': true,
      'symbol-sort-key': ['-', ['get', 'energyScore']],
    },
    paint: {
      'text-color': '#1a1a2e',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
      'text-halo-blur': 0.5,
    },
  } as unknown as LayerSpecification

  if (!hasValidMapboxToken) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,56,92,0.08),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(108,92,231,0.08),transparent_32%)]" />
        <div className="relative z-10 flex h-full items-center justify-center p-6">
          <div className="max-w-xl rounded-3xl border border-border/85 bg-white/90 p-8 text-center shadow-[0_24px_50px_-30px_rgba(17,24,39,0.4)] backdrop-blur-sm">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/15 bg-accent-light text-accent-strong">
              🌍
            </div>
            <h2 className="text-xl font-semibold text-text">Map view unavailable</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              A valid Mapbox access token is required to render the interactive globe.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Add <code className="rounded bg-surface-soft px-1.5 py-0.5 font-semibold text-text">VITE_MAPBOX_TOKEN</code> to your local
              environment, then restart the dev server.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <MapboxMap
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        longitude: 134,
        latitude: -25,
        zoom: 2,
        pitch: 0,
        bearing: 0,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={STANDARD_STYLE}
      projection={{ name: 'globe' }}
      attributionControl={false}
      logoPosition="bottom-left"
      onLoad={() => setMapLoaded(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={(e: MapMouseEvent) => {
        const feature = getCityFeature(e)
        const featureKey = getFeatureKey(feature)
        if (!featureKey) return
        const city = visibleCityByKey.get(featureKey)
        if (city) handleCityClick(city)
      }}
      interactiveLayerIds={['city-circles', 'city-labels']}
      cursor={hoveredCity ? 'pointer' : 'grab'}
    >
      {mapLoaded && (
        <>
          <Source id="astro-lines" type="geojson" data={linesGeoJSON}>
            {LINE_TYPE_STYLES.map((style) => (
              <Layer
                key={style.lineType}
                {...{
                  id: `astro-lines-${style.lineType.toLowerCase()}`,
                  type: 'line',
                  source: 'astro-lines',
                  slot: 'top',
                  filter: ['==', ['get', 'lineType'], style.lineType],
                  layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                  },
                  paint: {
                    'line-color': ['get', 'color'],
                    ...lineLayer,
                    ...(style.dasharray ? { 'line-dasharray': style.dasharray } : {}),
                  },
                } as unknown as LayerSpecification}
              />
            ))}
          </Source>

          <Source id="cities" type="geojson" data={citiesGeoJSON}>
            <Layer {...cityGlowLayer} />
            <Layer {...cityCircleLayer} />
            <Layer {...cityLabelLayer} />
          </Source>
        </>
      )}

      <AttributionControl position="bottom-left" compact />

      {hoveredCity && (
        <Popup
          longitude={hoveredCity.lng}
          latitude={hoveredCity.lat}
          offset={20}
          closeButton={false}
          closeOnClick={false}
          className="city-hover-popup"
        >
          <div className="min-w-[13rem] px-3.5 py-3 font-sans leading-relaxed">
            <div className="text-[15px] font-semibold text-text">
              {hoveredCity.name}
            </div>
            <div className="mb-2 text-xs text-muted">
              {hoveredCity.country}
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
              <span className="rounded-full border border-accent/15 bg-accent-light px-2.5 py-1 text-accent-strong">
                Energy {hoveredCity.energyScore.toFixed(1)}
              </span>
              <span className="rounded-full border border-border bg-surface-soft px-2.5 py-1 text-text">
                {hoveredCity.lineCount} lines
              </span>
            </div>
          </div>
        </Popup>
      )}
    </MapboxMap>
  )
}
