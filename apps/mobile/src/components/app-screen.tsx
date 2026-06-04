import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DashboardScreen } from '@/src/components/dashboard-screen'
import { OnboardingScreen } from '@/src/components/onboarding-screen'
import { SkeletonBlock, SkeletonCard, SkeletonText } from '@/src/components/skeleton'
import { useStore } from '@/src/store/useStore'
import { colors, fonts, radii, shadows } from '@/src/theme'

function LoadingScreen() {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const compact = width < 430

  return (
    <View
      accessibilityLabel="Restoring your travel map"
      accessibilityRole="progressbar"
      style={styles.loadingRoot}
    >
      <View style={styles.mapBackdrop}>
        <View style={[styles.mapLine, styles.mapLineOne]} />
        <View style={[styles.mapLine, styles.mapLineTwo]} />
        <View style={[styles.mapLine, styles.mapLineThree]} />
        <View style={[styles.mapDot, styles.mapDotOne]} />
        <View style={[styles.mapDot, styles.mapDotTwo]} />
        <View style={[styles.mapDot, styles.mapDotThree]} />
        <View style={[styles.mapDot, styles.mapDotFour]} />
      </View>

      <View style={[styles.loadingRail, { top: insets.top + 12 }]}>
        <SkeletonBlock height={48} width={compact ? 48 : 110} radius={16} style={styles.railButton} />
        <SkeletonBlock height={48} width={compact ? 48 : 110} radius={16} style={styles.railButton} />
      </View>

      <View style={[styles.loadingPanel, { bottom: insets.bottom + 18 }]}>
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderCopy}>
            <SkeletonBlock height={10} width={80} radius={radii.pill} />
            <SkeletonBlock height={30} width="62%" radius={radii.pill} />
          </View>
          <SkeletonBlock height={42} width={42} radius={14} />
        </View>

        <SkeletonCard style={styles.alignmentPreview}>
          <View style={styles.alignmentHeader}>
            <SkeletonBlock height={12} width={80} radius={radii.pill} />
            <SkeletonBlock height={18} width={44} radius={radii.pill} />
          </View>
          <SkeletonBlock height={8} radius={radii.pill} />
        </SkeletonCard>

        <SkeletonCard style={styles.cityPreview}>
          <SkeletonText lines={2} lineHeight={15} widths={['88%', '58%']} />
          <View style={styles.previewPills}>
            <SkeletonBlock height={28} width={86} radius={radii.pill} />
            <SkeletonBlock height={28} width={104} radius={radii.pill} />
          </View>
        </SkeletonCard>

        <Text style={styles.loadingBody}>Restoring your saved map</Text>
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
    backgroundColor: '#DCE8F4',
  },
  mapBackdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#DCE8F4',
  },
  mapLine: {
    position: 'absolute',
    width: 3,
    height: '130%',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 56, 92, 0.28)',
  },
  mapLineOne: {
    left: '24%',
    top: '-15%',
    transform: [{ rotate: '-18deg' }],
  },
  mapLineTwo: {
    left: '54%',
    top: '-10%',
    transform: [{ rotate: '12deg' }],
    backgroundColor: 'rgba(108, 92, 231, 0.24)',
  },
  mapLineThree: {
    left: '78%',
    top: '-18%',
    transform: [{ rotate: '-7deg' }],
    backgroundColor: 'rgba(20, 125, 90, 0.2)',
  },
  mapDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 3,
    borderColor: colors.accent,
  },
  mapDotOne: {
    left: '18%',
    top: '28%',
  },
  mapDotTwo: {
    left: '62%',
    top: '35%',
    borderColor: '#6C5CE7',
  },
  mapDotThree: {
    left: '42%',
    top: '56%',
    borderColor: colors.success,
  },
  mapDotFour: {
    left: '76%',
    top: '62%',
  },
  loadingRail: {
    position: 'absolute',
    left: 12,
    gap: 12,
  },
  railButton: {
    borderWidth: 1,
    borderColor: 'rgba(211, 215, 223, 0.96)',
    boxShadow: shadows.control,
  },
  loadingPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 12,
    borderRadius: 28,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(221, 225, 232, 0.98)',
    boxShadow: shadows.panel,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelHeaderCopy: {
    flex: 1,
    gap: 8,
  },
  alignmentPreview: {
    padding: 14,
  },
  alignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cityPreview: {
    padding: 14,
    backgroundColor: colors.surfaceSoft,
    borderColor: 'transparent',
  },
  previewPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  loadingBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.muted,
  },
})
