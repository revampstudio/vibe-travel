import type { PropsWithChildren } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/src/theme'

type MobileScrollScreenProps = PropsWithChildren<{
  backgroundColor?: string
  contentContainerStyle?: StyleProp<ViewStyle>
  extraBottomInset?: number
  keyboardOffset?: number
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps']
}>

export function MobileScrollScreen({
  backgroundColor = colors.bg,
  children,
  contentContainerStyle,
  extraBottomInset = 24,
  keyboardOffset = 0,
  keyboardShouldPersistTaps = 'handled',
}: MobileScrollScreenProps) {
  const insets = useSafeAreaInsets()

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS !== 'web'}
      keyboardVerticalOffset={keyboardOffset}
      style={[styles.root, { backgroundColor }]}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + extraBottomInset,
          },
          contentContainerStyle,
        ]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
})
