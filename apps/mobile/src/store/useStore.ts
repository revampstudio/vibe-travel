import { create } from 'zustand'
import { PLANETS } from '../lib/astrocartography'
import type { AppState, BirthData, Planet } from '../types/index'
import { readJSON, storage, writeJSON } from '../utils/storage'

const SESSION_KEY = 'vibe-travel-birth'

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
}))
