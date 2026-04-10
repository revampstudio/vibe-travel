import { Platform } from 'react-native'

import type { CityWithEnergy } from '@/src/types'

type WorldMapCardProps = {
  onCityPress: (city: CityWithEnergy) => void
}

export function WorldMapCard(props: WorldMapCardProps) {
  const Impl =
    Platform.OS === 'web'
      ? require('./world-map-card.web.tsx').WorldMapCard
      : require('./world-map-card.native.tsx').WorldMapCard

  return <Impl {...props} />
}
