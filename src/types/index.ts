export interface BirthData {
  date: string        // YYYY-MM-DD
  time: string        // HH:MM (24h)
  city: string
  lat: number
  lng: number
}

export type Planet = 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto'

export type LineType = 'MC' | 'IC' | 'ASC' | 'DSC'

export interface AstroLine {
  planet: Planet
  lineType: LineType
  coordinates: [number, number][]   // [lng, lat][]
  color: string
}

export interface SoulProfile {
  lifePathNumber: number
  personalYear: number
  lifeStage: string
  lifeStageDescription: string
  saturnReturn: boolean
  age: number
  insights: NumerologyInsights
}

export interface NumerologyInsights {
  lifePathMeaning: string
  birthdayNumber: number
  birthdayMeaning: string
  attitudeNumber: number
  attitudeMeaning: string
  personalMonth: number
  personalMonthMeaning: string
  nextPersonalYear: number
  nextLifeStage: string
  nextLifeStageDescription: string
}

export interface City {
  name: string
  country: string
  lat: number
  lng: number
}

export interface CityWithEnergy extends City {
  activeLines: AstroLine[]
  energyScore: number
}

export interface Retreat {
  id: string
  name: string
  city: string
  country: string
  type: string
  price: string
  description: string
  imageUrl: string
  isSponsored: boolean
  rating: number
}

export type ViewState = 'onboarding' | 'loading' | 'globe' | 'detail'
export type UtilityPanelState = 'settings' | 'insights' | null

export interface AppState {
  view: ViewState
  birthData: BirthData | null
  profile: SoulProfile | null
  astroLines: AstroLine[]
  cities: CityWithEnergy[]
  selectedCity: CityWithEnergy | null
  enabledPlanets: Set<Planet>
  activeUtilityPanel: UtilityPanelState

  setView: (view: ViewState) => void
  setBirthData: (data: BirthData) => void
  setProfile: (profile: SoulProfile) => void
  setAstroLines: (lines: AstroLine[]) => void
  setCities: (cities: CityWithEnergy[]) => void
  setSelectedCity: (city: CityWithEnergy | null) => void
  togglePlanet: (planet: Planet) => void
  setActiveUtilityPanel: (panel: UtilityPanelState) => void
  highlightedCity: string | null          // "CityName|Country" key
  setHighlightedCity: (key: string | null) => void
}
