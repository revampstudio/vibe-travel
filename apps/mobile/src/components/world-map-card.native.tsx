import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Mapbox, {
  Camera,
  CircleLayer,
  LineLayer,
  MapView,
  ShapeSource,
  StyleURL,
  type Camera as MapboxCameraRef,
} from '@rnmapbox/maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { declutterCities } from '@/src/lib/geo'
import { ENERGY_TIERS, LINE_TYPE_STYLES } from '@/src/lib/mapGuidance'
import { useStore } from '@/src/store/useStore'
import type { CityWithEnergy } from '@/src/types'
import { colors, fonts } from '@/src/theme'
import { cityKey } from '@/src/utils/cityKey'

interface RenderableCity extends CityWithEnergy {
  cityKey: string
  activeLineCount: number
  priorityScore: number
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? ''
const INITIAL_CENTER: [number, number] = [8, 12]
const INITIAL_ZOOM_LEVEL = 1.25
const CITY_ZOOM_LEVEL = 4.8
const MAJOR_CITY_PRIORITY_WINDOW = 1200
const MAJOR_CITY_PRIORITY_WEIGHT = 0.2
const CITY_DECLUTTER_DEGREES = 1.8

if (MAPBOX_TOKEN.trim()) {
  void Mapbox.setAccessToken(MAPBOX_TOKEN.trim())
  Mapbox.setTelemetryEnabled(false)
}

function hasValidMapboxToken(token: string | undefined) {
  return Boolean(token && token.trim() && !token.includes('your_token'))
}

function cityKeyFromFeature(feature: GeoJSON.Feature | undefined): string | null {
  const candidate = feature?.properties?.cityKey
  return typeof candidate === 'string' ? candidate : null
}

const energyColorExpression = [
  'step',
  ['get', 'energyScore'],
  ENERGY_TIERS[0].color,
  ENERGY_TIERS[1].min,
  ENERGY_TIERS[1].color,
  ENERGY_TIERS[2].min,
  ENERGY_TIERS[2].color,
  ENERGY_TIERS[3].min,
  ENERGY_TIERS[3].color,
] as const

const cityGlowStyle = {
  circleColor: energyColorExpression,
  circleRadius: ['interpolate', ['linear'], ['get', 'lineCount'], 0, 14, 3, 22, 6, 30],
  circleOpacity: 0.2,
  circleBlur: 0.95,
} as const

const cityCoreStyle = {
  circleColor: energyColorExpression,
  circleRadius: ['interpolate', ['linear'], ['get', 'lineCount'], 0, 4.8, 3, 7.2, 6, 9.4],
  circleOpacity: 0.94,
  circleStrokeColor: '#FFFFFF',
  circleStrokeWidth: 2,
} as const

const activeCityHaloStyle = {
  circleColor: '#FFFFFF',
  circleRadius: 16,
  circleOpacity: 0.18,
  circleBlur: 0.45,
} as const

const activeCityCoreStyle = {
  circleColor: energyColorExpression,
  circleRadius: 10.5,
  circleOpacity: 1,
  circleStrokeColor: '#FFFFFF',
  circleStrokeWidth: 3,
} as const

export function WorldMapCard({ onCityPress }: { onCityPress: (city: CityWithEnergy) => void }) {
  const cameraRef = useRef<MapboxCameraRef>(null)
  const insets = useSafeAreaInsets()
  const selectedCity = useStore((state) => state.selectedCity)
  const highlightedCity = useStore((state) => state.highlightedCity)
  const astroLines = useStore((state) => state.astroLines)
  const cities = useStore((state) => state.cities)
  const enabledPlanets = useStore((state) => state.enabledPlanets)

  const filteredLines = useMemo(
    () => astroLines.filter((line) => enabledPlanets.has(line.planet)),
    [astroLines, enabledPlanets],
  )

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
        cityKey: cityKey(city),
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

  const linesShape = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: filteredLines.map((line, index) => ({
      type: 'Feature' as const,
      id: `${line.planet}-${line.lineType}-${index}`,
      properties: {
        lineType: line.lineType,
        color: line.color,
        width: line.planet === 'Sun' || line.planet === 'Venus' || line.planet === 'Jupiter' ? 2.4 : 1.7,
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: line.coordinates,
      },
    })),
  }), [filteredLines])

  const citiesShape = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: renderableCities.map((city) => ({
      type: 'Feature' as const,
      id: city.cityKey,
      properties: {
        cityKey: city.cityKey,
        energyScore: city.energyScore,
        lineCount: city.activeLineCount,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [city.lng, city.lat] as [number, number],
      },
    })),
  }), [renderableCities])

  const selectedCityKey = selectedCity ? cityKey(selectedCity) : null

  const activeCitiesShape = useMemo(() => {
    const activeKeys = new Set(
      [selectedCityKey, highlightedCity].filter((value): value is string => Boolean(value)),
    )

    return {
      type: 'FeatureCollection' as const,
      features: renderableCities
        .filter((city) => activeKeys.has(city.cityKey))
        .map((city) => ({
          type: 'Feature' as const,
          id: `active-${city.cityKey}`,
          properties: {
            cityKey: city.cityKey,
            energyScore: city.energyScore,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [city.lng, city.lat] as [number, number],
          },
        })),
    }
  }, [highlightedCity, renderableCities, selectedCityKey])

  useEffect(() => {
    if (!selectedCity) return

    cameraRef.current?.setCamera({
      centerCoordinate: [selectedCity.lng, selectedCity.lat],
      zoomLevel: CITY_ZOOM_LEVEL,
      animationDuration: 900,
      animationMode: 'flyTo',
    })
  }, [selectedCity])

  const showTokenError = !hasValidMapboxToken(MAPBOX_TOKEN)

  return (
    <View style={styles.shell}>
      <View style={styles.mapFrame}>
        {!showTokenError ? (
          <MapView
            style={StyleSheet.absoluteFillObject}
            projection="globe"
            styleURL={StyleURL.Light}
            logoEnabled
            attributionEnabled
            compassEnabled={false}
            pitchEnabled={false}
            rotateEnabled
            scaleBarEnabled={false}
          >
            <Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: INITIAL_CENTER,
                zoomLevel: INITIAL_ZOOM_LEVEL,
                animationDuration: 0,
              }}
            />

            <ShapeSource id="astro-lines" shape={linesShape}>
              {LINE_TYPE_STYLES.map((style) => (
                <LineLayer
                  key={style.lineType}
                  id={`astro-lines-${style.lineType.toLowerCase()}`}
                  filter={['==', ['get', 'lineType'], style.lineType] as any}
                  style={{
                    lineColor: ['get', 'color'],
                    lineWidth: ['get', 'width'],
                    lineOpacity: 0.74,
                    lineCap: 'round',
                    lineJoin: 'round',
                    ...(style.dasharray ? { lineDasharray: style.dasharray } : {}),
                  } as any}
                />
              ))}
            </ShapeSource>

            <ShapeSource
              id="cities"
              hitbox={{ width: 28, height: 28 }}
              onPress={(event) => {
                const key = cityKeyFromFeature(event.features[0])
                if (!key) return

                const city = visibleCityByKey.get(key)
                if (!city) return

                onCityPress(city)
              }}
              shape={citiesShape}
            >
              <CircleLayer id="city-glow" style={cityGlowStyle as any} />
              <CircleLayer id="city-core" style={cityCoreStyle as any} />
            </ShapeSource>

            <ShapeSource id="active-cities" shape={activeCitiesShape}>
              <CircleLayer id="active-city-halo" style={activeCityHaloStyle as any} />
              <CircleLayer id="active-city-core" style={activeCityCoreStyle as any} />
            </ShapeSource>
          </MapView>
        ) : null}
      </View>

      {showTokenError ? (
        <View style={[styles.emptyState, { bottom: insets.bottom + 24 }]}>
          <Text style={styles.emptyStateTitle}>Mapbox token missing</Text>
          <Text style={styles.emptyStateBody}>
            Add `EXPO_PUBLIC_MAPBOX_TOKEN` to `apps/mobile/.env.local` before running the native Mapbox build.
          </Text>
        </View>
      ) : null}

      {!showTokenError && renderableCities.length === 0 ? (
        <View style={[styles.emptyState, { bottom: insets.bottom + 24 }]}>
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
    backgroundColor: '#DCE8F4',
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
