import { useRef, useCallback, useMemo, useEffect, useState } from 'react'
import Map, { Source, Layer, Popup } from 'react-map-gl/mapbox'
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox'
import type { LayerSpecification } from 'mapbox-gl'
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

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

const STANDARD_STYLE = 'mapbox://styles/mapbox/standard'
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
  const setHighlightedCity = useStore((s) => s.setHighlightedCity)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [hoveredCity, setHoveredCity] = useState<HoveredCity | null>(null)
  const hoveredIdRef = useRef<number | null>(null)
  const externalHighlightIdRef = useRef<number | null>(null)
  const [zoom, setZoom] = useState(2)

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

  const visibleCities = useMemo(() => {
    const withLines = cities
      .filter((c) => c.activeLines.some((l) => enabledPlanets.has(l.planet)))
      .sort((a, b) => b.energyScore - a.energyScore)
    // Scale declutter distance with zoom: 3° at globe, shrinks as you zoom in
    const minDeg = Math.max(0.1, 3 / Math.pow(2, Math.max(0, zoom - 2)))
    return declutterCities(withLines, minDeg)
  }, [cities, enabledPlanets, zoom])

  const citiesGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: visibleCities.map((city, i) => ({
      type: 'Feature' as const,
      id: i,
      properties: {
        id: i,
        name: city.name,
        country: city.country,
        energyScore: city.energyScore,
        lineCount: city.activeLines.filter(l => enabledPlanets.has(l.planet)).length,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [city.lng, city.lat],
      },
    })),
  }), [visibleCities, enabledPlanets])

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

  // Sync highlightedCity (from sidebar hover) → Mapbox feature-state
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    const map = mapRef.current.getMap()
    if (!map.getSource('cities')) return

    // Clear previous external highlight
    if (externalHighlightIdRef.current !== null) {
      map.setFeatureState(
        { source: 'cities', id: externalHighlightIdRef.current },
        { hover: false },
      )
      externalHighlightIdRef.current = null
    }

    if (highlightedCity) {
      const [name, country] = highlightedCity.split('|')
      const idx = visibleCities.findIndex(
        (c) => c.name === name && c.country === country,
      )
      if (idx !== -1) {
        // Don't double-highlight if user's mouse is already on the same feature
        if (hoveredIdRef.current !== idx) {
          externalHighlightIdRef.current = idx
          map.setFeatureState(
            { source: 'cities', id: idx },
            { hover: true },
          )
        }
      }
    }
  }, [highlightedCity, visibleCities, mapLoaded])

  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()

    // Layers may not exist yet during style loading
    if (!map.getLayer('city-circles')) return

    const features = mapRef.current.queryRenderedFeatures(e.point, {
      layers: ['city-circles', 'city-labels'],
    })

    // Clear previous hover state
    if (hoveredIdRef.current !== null) {
      map.setFeatureState(
        { source: 'cities', id: hoveredIdRef.current },
        { hover: false },
      )
      hoveredIdRef.current = null
    }

    if (features.length > 0) {
      const feat = features[0]
      const props = feat.properties
      if (props) {
        const featureId = props.id as number
        hoveredIdRef.current = featureId
        map.setFeatureState(
          { source: 'cities', id: featureId },
          { hover: true },
        )

        const city = visibleCities.find(
          (c) => c.name === props.name && c.country === props.country,
        )
        if (city) {
          setHoveredCity({
            name: city.name,
            country: city.country,
            lng: city.lng,
            lat: city.lat,
            energyScore: city.energyScore,
            lineCount: props.lineCount as number,
          })
          setHighlightedCity(`${city.name}|${city.country}`)
        }
      }
    } else {
      setHoveredCity(null)
      setHighlightedCity(null)
    }
  }, [visibleCities, setHighlightedCity])

  const handleMouseLeave = useCallback(() => {
    if (hoveredIdRef.current !== null && mapRef.current) {
      mapRef.current.getMap().setFeatureState(
        { source: 'cities', id: hoveredIdRef.current },
        { hover: false },
      )
      hoveredIdRef.current = null
    }
    setHoveredCity(null)
    setHighlightedCity(null)
  }, [setHighlightedCity])

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
        ['boolean', ['feature-state', 'hover'], false],
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
        ['boolean', ['feature-state', 'hover'], false],
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
        ['boolean', ['feature-state', 'hover'], false],
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
        ['boolean', ['feature-state', 'hover'], false],
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

  return (
    <Map
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
      onLoad={() => setMapLoaded(true)}
      onZoom={(e) => {
        // Round to nearest 0.5 to avoid excessive recalculations
        const z = Math.round(e.viewState.zoom * 2) / 2
        setZoom((prev) => prev === z ? prev : z)
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={(e: MapMouseEvent) => {
        if (!mapRef.current) return
        if (!mapRef.current.getMap().getLayer('city-circles')) return
        const features = mapRef.current.queryRenderedFeatures(e.point, {
          layers: ['city-circles', 'city-labels'],
        })
        if (features.length > 0) {
          const props = features[0].properties
          if (props) {
            const city = visibleCities.find(
              (c) => c.name === props.name && c.country === props.country,
            )
            if (city) handleCityClick(city)
          }
        }
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

      {hoveredCity && (
        <Popup
          longitude={hoveredCity.lng}
          latitude={hoveredCity.lat}
          offset={20}
          closeButton={false}
          closeOnClick={false}
          className="city-hover-popup"
        >
          <div style={{
            padding: '8px 12px',
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.4,
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>
              {hoveredCity.name}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
              {hoveredCity.country}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Energy </span>
                <span style={{ color: '#FF385C', fontWeight: 600 }}>
                  {hoveredCity.energyScore.toFixed(1)}
                </span>
              </div>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Lines </span>
                <span style={{ color: '#FF385C', fontWeight: 600 }}>
                  {hoveredCity.lineCount}
                </span>
              </div>
            </div>
          </div>
        </Popup>
      )}
    </Map>
  )
}
