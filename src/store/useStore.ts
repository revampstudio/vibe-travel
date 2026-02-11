import { create } from 'zustand'
import type { AppState, BirthData, Planet } from '../types/index.ts'

const SESSION_KEY = 'soul-cartography-birth'

function loadBirthData(): BirthData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveBirthData(data: BirthData | null) {
  try {
    if (data) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
  } catch {
    // sessionStorage unavailable
  }
}

const savedBirth = loadBirthData()

export const useStore = create<AppState>((set) => ({
  view: savedBirth ? 'loading' : 'onboarding',
  birthData: savedBirth,
  profile: null,
  astroLines: [],
  cities: [],
  selectedCity: null,
  enabledPlanets: new Set<Planet>(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']),
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
  togglePlanet: (planet) =>
    set((state) => {
      const next = new Set(state.enabledPlanets)
      if (next.has(planet)) {
        next.delete(planet)
      } else {
        next.add(planet)
      }
      return { enabledPlanets: next }
    }),
  setHighlightedCity: (highlightedCity) => set({ highlightedCity }),
}))
