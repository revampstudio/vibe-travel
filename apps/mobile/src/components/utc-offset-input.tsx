import { Text, TextInput, View } from 'react-native'
import { colors } from '@/src/theme'
import { parseUtcOffset } from '@/src/lib/birthTime'
export { parseUtcOffset, formatUtcOffset } from '@/src/lib/birthTime'
export function UtcOffsetInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <View style={{ gap: 8 }}>
    <Text style={{ fontWeight: '700', color: colors.text }}>Birthplace UTC offset on your birth date</Text>
    <TextInput accessibilityLabel="Birthplace UTC offset" autoCapitalize="none" autoCorrect={false} placeholder="For example +10:00" value={value} onChangeText={onChange} style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, backgroundColor: colors.surface }} />
    <Text style={{ color: colors.muted, lineHeight: 19 }}>Use the offset that applied in your birth city on that date, including daylight saving. Brisbane: +10:00. New York: -05:00 in standard time or -04:00 in daylight time. Check your historical time zone if unsure.</Text>
    {value !== '' && parseUtcOffset(value) === null ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>Use +HH:MM or -HH:MM, between -12:00 and +14:00.</Text> : null}
  </View>
}
