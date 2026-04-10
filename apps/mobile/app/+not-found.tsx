import { Link } from 'expo-router'
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'

export default function NotFoundScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.body}>The route you asked for is not part of this scaffold yet.</Text>
        <Link href="/" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Go home</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F5F7FB',
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
