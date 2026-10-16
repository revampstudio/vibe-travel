import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { resolveBirthTimeZone } from '@/src/lib/birthTimeZone'
import { UtcOffsetInput, parseUtcOffset, formatUtcOffset } from './utc-offset-input'
import type { GeoResult } from '@/src/lib/birthCityAutocomplete'
import type { BirthData } from '@/src/types'
import { colors } from '@/src/theme'
export function useBirthTimeZone(date: string, time: string, location: GeoResult | null, initial?: BirthData | null) {
  const [manual, setManual] = useState(initial?.utcOffsetSource === 'manual')
  const [offset, setOffset] = useState(initial?.utcOffsetSource === 'manual' ? formatUtcOffset(initial.utcOffsetMinutes) : '')
  const inputKey = `${date}|${time}|${location?.center.join(',') ?? ''}`
  const previousInput = useRef(inputKey)
  useEffect(() => {
    if (previousInput.current !== inputKey) { setManual(false); setOffset(''); previousInput.current = inputKey }
  }, [inputKey])
  const resolution = useMemo(() => resolveBirthTimeZone(date, time, location?.center[1], location?.center[0]), [date, time, location])
  const parsed = parseUtcOffset(offset)
  const manualAllowed = resolution.status !== 'invalid' && resolution.status !== 'pending'
  const validManual = manual && manualAllowed && parsed !== null && (resolution.status !== 'ambiguous' || resolution.choices.some(choice => choice.offsetMinutes === parsed))
  const offsetMinutes = manual ? (validManual ? parsed : null) : resolution.status === 'ready' ? resolution.offsetMinutes : null
  const timeZone = 'timeZone' in resolution ? resolution.timeZone : undefined
  const control = <View style={{ gap: 10 }}>
    {resolution.status === 'ready' ? <Text style={{ color: colors.muted, lineHeight: 20 }}>Time zone: {resolution.timeZone.replaceAll('_', ' ')} · UTC{resolution.offset} on your birth date. Daylight saving is included automatically.</Text> : null}
    {resolution.status === 'pending' ? <Text style={{ color: colors.muted, lineHeight: 20 }}>Choose a birth city to set the historical time zone automatically.</Text> : null}
    {'message' in resolution ? <Text accessibilityRole="alert" style={{ color: resolution.status === 'unavailable' ? colors.muted : colors.danger, lineHeight: 20 }}>{resolution.message}</Text> : null}
    {resolution.status === 'ambiguous' ? <View style={{ gap: 8 }}>{resolution.choices.map(choice => <Pressable key={choice.offset} accessibilityRole="button" accessibilityState={{ selected: validManual && parsed === choice.offsetMinutes }} onPress={() => { setOffset(choice.offset); setManual(true) }} style={{ padding: 12, borderRadius: 10, backgroundColor: validManual && parsed === choice.offsetMinutes ? colors.accentSoft : colors.surfaceSoft }}><Text style={{ color: colors.text }}>Use UTC{choice.offset}</Text></Pressable>)}</View> : null}
    {manualAllowed ? <Pressable accessibilityRole="button" onPress={() => setManual(!manual)}><Text style={{ color: colors.accentStrong, fontWeight: '700', paddingVertical: 6 }}>{manual ? 'Use automatic time zone' : 'Advanced: set UTC offset manually'}</Text></Pressable> : null}
    {manual && manualAllowed ? <><UtcOffsetInput value={offset} onChange={setOffset} /><Text style={{ color: colors.muted, lineHeight: 20 }}>Manual override replaces the automatic offset. Use it only when you have verified the historical offset for this birth record.</Text></> : null}
  </View>
  return { offsetMinutes, timeZone, source: manual ? 'manual' as const : 'automatic' as const, control }
}
