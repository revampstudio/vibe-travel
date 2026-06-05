import { create } from 'zustand'
import { PLANETS } from '../lib/astrocartography'
import type { AppState, BirthData, Planet, TripIntent } from '../types/index'
import { readJSON, storage, writeJSON } from '../utils/storage'

const SESSION_KEY = 'vibe-travel-birth'
const TRIP_INTENT_KEY = 'vibe-travel-trip-intent'
const TRIP_INTENTS = new Set<TripIntent>(['open', 'adventure', 'spirituality', 'surf', 'romance', 'reset', 'culture', 'career'])

function loadBirthData(): BirthData | null {
  return readJSON<BirthData | null>(SESSION_KEY, null)
}

function saveBirthData(data: BirthData | null) {
  if (data) {
    writeJSON(SESSION_KEY, data)
    return
  }

  storage.removeItem(SESSION_KEY)
}

const savedBirth = loadBirthData()
const storedTripIntent = readJSON<TripIntent>(TRIP_INTENT_KEY, 'open')
const savedTripIntent = TRIP_INTENTS.has(storedTripIntent) ? storedTripIntent : 'open'

export const useStore = create<AppState>((set) => ({
  view: savedBirth ? 'loading' : 'onboarding',
  birthData: savedBirth,
  profile: null,
  astroLines: [],
  cities: [],
  selectedCity: null,
  enabledPlanets: new Set<Planet>(PLANETS),
  activeUtilityPanel: null,
  highlightedCity: null,
  selectedTripIntent: savedTripIntent,

  setView: (view) => set({ view }),
  setBirthData: (birthData) => {
    saveBirthData(birthData)
    set({ birthData })
  },
  setProfile: (profile) => set({ profile }),
  setAstroLines: (astroLines) => set({ astroLines }),
  setCities: (cities) => set({ cities }),
  setSelectedCity: (selectedCity) => set({ selectedCity }),
  setActiveUtilityPanel: (activeUtilityPanel) => set({ activeUtilityPanel }),
  togglePlanet: () => set((state) => ({ enabledPlanets: new Set(state.enabledPlanets) })),
  setHighlightedCity: (highlightedCity) => set({ highlightedCity }),
  setSelectedTripIntent: (selectedTripIntent) => {
    writeJSON(TRIP_INTENT_KEY, selectedTripIntent)
    set({ selectedTripIntent })
  },
}))
