import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'

import { computeAstroLines } from '@/src/lib/astrocartography'
import { preloadBirthCityAutocomplete, searchBirthCities, type GeoResult } from '@/src/lib/birthCityAutocomplete'
import { enrichCitiesWithEnergy } from '@/src/lib/geo'
import { calcSoulProfile } from '@/src/lib/numerology'
import { loadCities } from '@/src/data/loadCities'
import { useStore } from '@/src/store/useStore'
import type { BirthData } from '@/src/types'
import { colors, fonts, radii, shadows } from '@/src/theme'

const STEP_COPY = {
  1: {
    title: 'How Vibe Travel works',
    description: 'A quick overview before we build your personal map.',
  },
  2: {
    title: 'Start with your birthday',
    description: 'We use your birth date to calculate your numerology profile and map timing.',
  },
  3: {
    title: 'Add birth details',
    description: 'Birth time and city let us place your planetary lines accurately on the globe.',
  },
} as const

const HOW_IT_WORKS = [
  'We use your birthday to calculate your numerology profile.',
  'We map planetary lines from your birth time and location.',
  'We rank cities by alignment so you can explore your best matches.',
] as const

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeBirthday(day: string, month: string, year: string): string | null {
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)

  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null
  if (y < 1900 || m < 1 || m > 12) return null

  const maxDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  if (d < 1 || d > maxDay) return null

  const birthDate = new Date(Date.UTC(y, m - 1, d))
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  if (birthDate > todayUtc) return null

  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getBirthdayError(day: string, month: string, year: string): string | null {
  if (!day || !month || !year) return 'Enter your full birthday.'
  if (day.length > 2 || month.length > 2 || year.length !== 4) return 'Use DD, MM, and YYYY.'
  if (!normalizeBirthday(day, month, year)) return 'Enter a valid date in the past.'
  return null
}

export function OnboardingScreen() {
  const { setBirthData, setProfile, setAstroLines, setCities, setView, view } = useStore()
  const { width } = useWindowDimensions()

  const [step, setStep] = useState<1 | 2 | 3>(view === 'loading' ? 3 : 1)
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [timeKnown, setTimeKnown] = useState(true)
  const [time, setTime] = useState('12:00')
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<GeoResult[]>([])
  const [selectedGeo, setSelectedGeo] = useState<GeoResult | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [showBirthdayErrors, setShowBirthdayErrors] = useState(false)
  const [showSubmitErrors, setShowSubmitErrors] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestIdRef = useRef(0)

  const isCompact = width < 640
  const titleSize = isCompact ? 35 : 46
  const titleLineHeight = isCompact ? 42 : 52
  const bodySize = isCompact ? 16 : 18
  const bodyLineHeight = isCompact ? 28 : 32

  useEffect(() => {
    void preloadBirthCityAutocomplete()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      const requestId = ++searchRequestIdRef.current

      if (cityQuery.trim().length < 2) {
        setCityResults([])
        return
      }

      void searchBirthCities(cityQuery, {
        limit: 3,
        includeMapbox: true,
        mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
      }).then((results) => {
        if (requestId === searchRequestIdRef.current) {
          setCityResults(results)
        }
      })
    }, 280)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [cityQuery])

  const birthdayError = useMemo(
    () => getBirthdayError(birthDay, birthMonth, birthYear),
    [birthDay, birthMonth, birthYear],
  )
  const birthdayIso = useMemo(
    () => normalizeBirthday(birthDay, birthMonth, birthYear),
    [birthDay, birthMonth, birthYear],
  )

  const cityError = showSubmitErrors && !selectedGeo ? 'Choose your birth city from the suggestions.' : null
  const timeError = showSubmitErrors && timeKnown && !time ? 'Enter your birth time, or choose “I do not know”.' : null
  const canSubmit = Boolean(birthdayIso && selectedGeo && (!timeKnown || time) && !isSubmitting)

  const handleCitySelect = (result: GeoResult) => {
    setSelectedGeo(result)
    setCityQuery(result.place_name)
    setShowResults(false)
  }

  const handleSubmit = async () => {
    setShowSubmitErrors(true)
    if (!birthdayIso || !selectedGeo || !canSubmit) return

    setIsSubmitting(true)

    const birthData: BirthData = {
      date: birthdayIso,
      time: timeKnown ? time : '12:00',
      city: selectedGeo.place_name,
      lng: selectedGeo.center[0],
      lat: selectedGeo.center[1],
    }

    const profile = calcSoulProfile(birthData.date)
    const astroLines = computeAstroLines(birthData.date, birthData.time)
    const cities = await loadCities()
    const enrichedCities = enrichCitiesWithEnergy(cities, astroLines)

    setBirthData(birthData)
    setProfile(profile)
    setAstroLines(astroLines)
    setCities(enrichedCities)
    setView('globe')
    setIsSubmitting(false)
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.shell, isCompact ? styles.shellCompact : null]}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark} />
            <View>
              <Text style={styles.kicker}>Vibe Travel</Text>
              <Text style={styles.brandSubhead}>Personal map setup</Text>
            </View>
          </View>
          <Text style={styles.stepPill}>Step {step} of 3</Text>
        </View>

        <Text style={[styles.title, { fontSize: titleSize, lineHeight: titleLineHeight }]}>
          {STEP_COPY[step].title}
        </Text>
        <Text style={[styles.body, { fontSize: bodySize, lineHeight: bodyLineHeight }]}>
          {STEP_COPY[step].description}
        </Text>

        <View style={styles.progressRow}>
          {[1, 2, 3].map((value) => (
            <View key={value} style={[styles.progressBar, step >= value ? styles.progressBarActive : null]} />
          ))}
        </View>

        {step === 1 ? (
          <View style={styles.stepBlock}>
            <View style={styles.softPanel}>
              <Text style={styles.panelLabel}>How it works</Text>
              {HOW_IT_WORKS.map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.cardBody}>{item}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.helperText}>Setup takes less than a minute.</Text>

            <Pressable style={styles.primaryButton} onPress={() => setStep(2)}>
              <Text style={styles.primaryButtonText}>Start setup</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.stepBlock}>
            <View>
              <Text style={styles.fieldLabel}>Birthday</Text>
              <View style={[styles.birthdayRow, isCompact ? styles.birthdayStack : null]}>
                <TextInput
                  value={birthDay}
                  onChangeText={(value) => setBirthDay(digitsOnly(value).slice(0, 2))}
                  placeholder="DD"
                  keyboardType="number-pad"
                  style={[styles.input, styles.birthdayInput, styles.centerText]}
                />
                <TextInput
                  value={birthMonth}
                  onChangeText={(value) => setBirthMonth(digitsOnly(value).slice(0, 2))}
                  placeholder="MM"
                  keyboardType="number-pad"
                  style={[styles.input, styles.birthdayInput, styles.centerText]}
                />
                <TextInput
                  value={birthYear}
                  onChangeText={(value) => setBirthYear(digitsOnly(value).slice(0, 4))}
                  placeholder="YYYY"
                  keyboardType="number-pad"
                  style={[styles.input, styles.birthdayInput, styles.centerText]}
                />
              </View>
              {showBirthdayErrors && birthdayError ? <Text style={styles.errorText}>{birthdayError}</Text> : null}
            </View>

            <View style={[styles.actionRow, isCompact ? styles.actionColumn : null]}>
              <Pressable style={[styles.secondaryButton, !isCompact ? styles.secondaryFixed : null]} onPress={() => setStep(1)}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  setShowBirthdayErrors(true)
                  if (!birthdayError) setStep(3)
                }}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.stepBlock}>
            <View>
              <Text style={styles.fieldLabel}>Birth time</Text>
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="12:00"
                autoCapitalize="none"
                editable={timeKnown}
                style={[styles.input, !timeKnown ? styles.inputDisabled : null]}
              />

              <Pressable
                style={styles.checkboxRow}
                onPress={() => setTimeKnown((current) => !current)}
              >
                <View style={[styles.checkbox, !timeKnown ? styles.checkboxChecked : null]}>
                  {!timeKnown ? <View style={styles.checkboxInner} /> : null}
                </View>
                <Text style={styles.checkboxText}>I do not know my birth time (use 12:00 PM)</Text>
              </Pressable>
              {timeError ? <Text style={styles.errorText}>{timeError}</Text> : null}
            </View>

            <View style={styles.cityFieldWrap}>
              <Text style={styles.fieldLabel}>Birth city</Text>
              <TextInput
                value={cityQuery}
                onChangeText={(value) => {
                  setCityQuery(value)
                  setSelectedGeo(null)
                  setShowResults(true)
                }}
                onFocus={() => setShowResults(true)}
                placeholder="Search for your birth city"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              {showResults && cityResults.length > 0 ? (
                <View style={styles.resultsOverlay}>
                  {cityResults.slice(0, 3).map((result, index) => {
                    const selected = selectedGeo?.place_name === result.place_name
                    return (
                      <Pressable
                        key={`${result.place_name}-${index}`}
                        onPress={() => handleCitySelect(result)}
                        style={[styles.resultRow, selected ? styles.resultRowSelected : null]}
                      >
                        <View style={styles.resultTextWrap}>
                          <Text style={styles.resultTitle}>{result.place_name}</Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              ) : null}

              {cityError ? <Text style={styles.errorText}>{cityError}</Text> : null}
            </View>

            <View style={[styles.actionRow, isCompact ? styles.actionColumn : null]}>
              <Pressable style={[styles.secondaryButton, !isCompact ? styles.secondaryFixed : null]} onPress={() => setStep(2)}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, !canSubmit ? styles.primaryButtonDisabled : null]}
                disabled={!canSubmit}
                onPress={() => void handleSubmit()}
              >
                {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Build my map</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: colors.bg,
  },
  shell: {
    width: '100%',
    maxWidth: 768,
    gap: 16,
    padding: 24,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(221, 225, 232, 0.98)',
    backgroundColor: colors.surface,
    boxShadow: shadows.panel,
  },
  shellCompact: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(227, 230, 235, 0.85)',
    paddingBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  kicker: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  brandSubhead: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  stepPill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontFamily: fonts.serif,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    maxWidth: 672,
    fontFamily: fonts.sans,
    color: colors.muted,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  progressBarActive: {
    backgroundColor: colors.accent,
  },
  stepBlock: {
    gap: 24,
  },
  softPanel: {
    gap: 10,
    borderRadius: radii.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.surfaceSoft,
  },
  panelLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bulletDot: {
    width: 8,
    height: 8,
    marginTop: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  cardBody: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
  },
  fieldLabel: {
    marginBottom: 10,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  birthdayRow: {
    flexDirection: 'row',
    gap: 12,
  },
  birthdayStack: {
    flexDirection: 'column',
  },
  birthdayInput: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  input: {
    width: '100%',
    minHeight: 54,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
    boxShadow: '0 1px 2px rgba(17, 24, 39, 0.04)',
  },
  inputDisabled: {
    borderColor: 'rgba(227, 230, 235, 0.7)',
    color: 'rgba(95, 103, 119, 0.6)',
  },
  centerText: {
    textAlign: 'center',
  },
  helperText: {
    marginTop: 8,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  checkboxRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  checkboxInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  checkboxText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
  },
  cityFieldWrap: {
    position: 'relative',
    zIndex: 4,
  },
  resultsOverlay: {
    position: 'absolute',
    top: 86,
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.popover,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(227, 230, 235, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  resultRowSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(255, 56, 92, 0.24)',
  },
  resultTextWrap: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  resultSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionColumn: {
    flexDirection: 'column',
  },
  secondaryFixed: {
    width: 140,
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    boxShadow: shadows.accent,
  },
  primaryButtonDisabled: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    boxShadow: 'none',
  },
  primaryButtonText: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  errorText: {
    marginTop: 8,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
    color: colors.accent,
  },
})
