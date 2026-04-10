import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline, type Region } from 'react-native-maps'

import { declutterCities } from '@/src/lib/geo'
import { ENERGY_TIERS, LINE_TYPE_STYLES } from '@/src/lib/mapGuidance'
import { useStore } from '@/src/store/useStore'
import type { CityWithEnergy } from '@/src/types'
import { colors, fonts, radii } from '@/src/theme'
import { cityKey } from '@/src/utils/cityKey'

const INITIAL_REGION: Region = {
  latitude: 12,
  longitude: 8,
  latitudeDelta: 120,
  longitudeDelta: 140,
}

const CITY_REGION_DELTA = 18
const MAJOR_CITY_PRIORITY_WINDOW = 1200
const MAJOR_CITY_PRIORITY_WEIGHT = 0.2
const CITY_DECLUTTER_DEGREES = 1.8

function energyColor(score: number): string {
  const tier = ENERGY_TIERS.find((entry) => score >= entry.min && score < entry.max)
  return tier?.color ?? ENERGY_TIERS[0].color
}

function linePattern(lineType: string) {
  const style = LINE_TYPE_STYLES.find((entry) => entry.lineType === lineType)
  return style?.dasharray
}

export function WorldMapCard({ onCityPress }: { onCityPress: (city: CityWithEnergy) => void }) {
  const mapRef = useRef<MapView>(null)
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

    const withLines: Array<CityWithEnergy & { priorityScore: number }> = []

    for (let sourceRank = 0; sourceRank < cities.length; sourceRank += 1) {
      const city = cities[sourceRank]
      const activeLines = city.activeLines.filter((line) => enabledPlanets.has(line.planet))
      if (activeLines.length === 0) continue

      withLines.push({
        ...city,
        activeLines,
        priorityScore: city.energyScore + prominence(sourceRank),
      })
    }

    withLines.sort((a, b) => b.energyScore - a.energyScore)
    return declutterCities(withLines, CITY_DECLUTTER_DEGREES, (city) => city.priorityScore).slice(0, 80)
  }, [cities, enabledPlanets])

  const selectedCityKey = selectedCity ? cityKey(selectedCity) : null

  useEffect(() => {
    if (!selectedCity) return

    mapRef.current?.animateToRegion(
      {
        latitude: selectedCity.lat,
        longitude: selectedCity.lng,
        latitudeDelta: CITY_REGION_DELTA,
        longitudeDelta: CITY_REGION_DELTA,
      },
      900,
    )
  }, [selectedCity])

  return (
    <View style={styles.shell}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={INITIAL_REGION}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        {filteredLines.map((line, index) => (
          <Polyline
            key={`${line.planet}-${line.lineType}-${index}`}
            coordinates={line.coordinates.map(([longitude, latitude]) => ({ longitude, latitude }))}
            strokeColor={line.color}
            strokeWidth={line.planet === 'Sun' || line.planet === 'Venus' || line.planet === 'Jupiter' ? 2.4 : 1.7}
            lineDashPattern={linePattern(line.lineType)}
          />
        ))}

        {renderableCities.map((city) => {
          const key = cityKey(city)
          const active = key === highlightedCity || key === selectedCityKey
          return (
            <Marker
              key={key}
              coordinate={{ latitude: city.lat, longitude: city.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => onCityPress(city)}
            >
              <View
                style={[
                  styles.markerOuter,
                  active ? styles.markerOuterActive : null,
                  { borderColor: energyColor(city.energyScore) },
                ]}
              >
                <View style={[styles.markerInner, { backgroundColor: energyColor(city.energyScore) }]} />
              </View>
            </Marker>
          )
        })}
      </MapView>

      {renderableCities.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Map loading</Text>
          <Text style={styles.emptyStateBody}>Your astrocartography lines and city markers will appear as soon as your profile finishes hydrating.</Text>
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
  markerOuter: {
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    padding: 3,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  markerOuterActive: {
    width: 24,
    height: 24,
    padding: 4,
    backgroundColor: '#FFFFFF',
  },
  markerInner: {
    flex: 1,
    borderRadius: radii.pill,
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
