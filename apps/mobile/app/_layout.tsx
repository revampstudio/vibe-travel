import 'react-native-gesture-handler'
import 'expo-sqlite/localStorage/install'

import { useEffect } from 'react'
import { Stack } from 'expo-router/stack'
import { Platform } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AppBootstrap } from '@/src/components/app-bootstrap'
import { AnalyticsProvider } from '@/src/lib/analytics'
import { colors, fonts } from '@/src/theme'

function ensureWebFonts() {
  if (typeof document === 'undefined') return
  if (document.getElementById('vibe-travel-fonts')) return

  const preconnect = document.createElement('link')
  preconnect.id = 'vibe-travel-fonts'
  preconnect.rel = 'preconnect'
  preconnect.href = 'https://fonts.googleapis.com'
  document.head.appendChild(preconnect)

  const preconnectStatic = document.createElement('link')
  preconnectStatic.rel = 'preconnect'
  preconnectStatic.href = 'https://fonts.gstatic.com'
  preconnectStatic.crossOrigin = 'anonymous'
  document.head.appendChild(preconnectStatic)

  const sheet = document.createElement('link')
  sheet.rel = 'stylesheet'
  sheet.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap'
  document.head.appendChild(sheet)
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') ensureWebFonts()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AnalyticsProvider>
        <SafeAreaProvider>
          <AppBootstrap />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              headerStyle: { backgroundColor: colors.bg },
              headerTitleStyle: {
                color: colors.text,
                fontFamily: fonts.serif,
              },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Vibe Travel' }} />
            <Stack.Screen
              name="city/[cityKey]"
              options={{
                headerShadowVisible: false,
                headerShown: true,
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
                headerTitleStyle: {
                  color: colors.text,
                  fontFamily: fonts.serif,
                },
                title: 'City Details',
              }}
            />
          </Stack>
        </SafeAreaProvider>
      </AnalyticsProvider>
    </GestureHandlerRootView>
  )
}
