import { StatusBar } from 'expo-status-bar'

import { DashboardScreen } from '@/src/components/dashboard-screen'
import { OnboardingScreen } from '@/src/components/onboarding-screen'
import { useStore } from '@/src/store/useStore'

export function AppScreen() {
  const view = useStore((state) => state.view)

  return (
    <>
      <StatusBar style="dark" />
      {view === 'onboarding' || view === 'loading' ? <OnboardingScreen /> : <DashboardScreen />}
    </>
  )
}
