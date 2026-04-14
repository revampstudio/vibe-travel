import { Link } from 'expo-router'
import { StyleSheet, Text, View, Pressable } from 'react-native'

import { MobileScrollScreen } from '@/src/components/mobile-scroll-screen'

export default function NotFoundScreen() {
  return (
    <MobileScrollScreen contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.body}>The route you asked for is not part of this scaffold yet.</Text>
        <Link href="/" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Go home</Text>
          </Pressable>
        </Link>
      </View>
    </MobileScrollScreen>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    gap: 12,
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#0F172A',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
  },
  button: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
