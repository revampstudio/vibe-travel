import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DashboardScreen } from '@/src/components/dashboard-screen'
import { OnboardingScreen } from '@/src/components/onboarding-screen'
import { useStore } from '@/src/store/useStore'
import { colors, fonts, radii, shadows } from '@/src/theme'

function LoadingScreen() {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.loadingRoot, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.loadingCard}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingTitle}>Restoring your map</Text>
        <Text style={styles.loadingBody}>Loading your saved birth data and city matches.</Text>
      </View>
    </View>
  )
}

export function AppScreen() {
  const view = useStore((state) => state.view)

  return (
    <>
      <StatusBar style="dark" />
      {view === 'loading' ? <LoadingScreen /> : view === 'onboarding' ? <OnboardingScreen /> : <DashboardScreen />}
    </>
  )
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  loadingCard: {
    gap: 10,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.lg,
    padding: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: shadows.panel,
    alignItems: 'center',
  },
  loadingTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  loadingBody: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
  },
})
