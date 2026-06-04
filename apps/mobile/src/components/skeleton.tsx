import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { colors, radii } from '@/src/theme'

type SkeletonBlockProps = {
  height: number
  width?: number | `${number}%`
  radius?: number
  style?: StyleProp<ViewStyle>
}

export function SkeletonBlock({
  height,
  width = '100%',
  radius = radii.md,
  style,
}: SkeletonBlockProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true)
  }, [progress])

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['#E9EDF2', '#F5F7FA'],
    ),
  }))

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.block,
        {
          borderRadius: radius,
          height,
          width,
        },
        animatedStyle,
        style,
      ]}
    />
  )
}

export function SkeletonText({
  lines = 2,
  lineHeight = 14,
  gap = 8,
  widths = ['100%', '72%'],
  style,
}: {
  lines?: number
  lineHeight?: number
  gap?: number
  widths?: Array<number | `${number}%`>
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Animated.View style={[styles.textStack, { gap }, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock
          key={index}
          height={lineHeight}
          radius={radii.pill}
          width={widths[index] ?? widths[widths.length - 1] ?? '100%'}
        />
      ))}
    </Animated.View>
  )
}

export function SkeletonCard({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <Animated.View style={[styles.card, style]}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surfaceSoft,
  },
  textStack: {
    width: '100%',
  },
  card: {
    gap: 12,
    borderRadius: radii.lg,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
})
