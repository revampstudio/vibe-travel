import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
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
import { MobileScrollScreen } from '@/src/components/mobile-scroll-screen'
import { loadCities } from '@/src/data/loadCities'
import { useStore } from '@/src/store/useStore'
import type { BirthData } from '@/src/types'
import { colors, fonts, radii, shadows } from '@/src/theme'

const VIBE_TRAVEL_LOGO = require('../../assets/brand/logo-512.png')

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
  const { setBirthData, setProfile, setAstroLines, setCities, setView } = useStore()
  const { width } = useWindowDimensions()

  const [step, setStep] = useState<1 | 2 | 3>(1)
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
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestIdRef = useRef(0)
  const monthInputRef = useRef<TextInput>(null)
  const yearInputRef = useRef<TextInput>(null)
  const timeInputRef = useRef<TextInput>(null)
  const cityInputRef = useRef<TextInput>(null)
  const focusTimeAfterStep3Ref = useRef(false)

  const isCompact = width < 640
  const isNarrow = width < 420
  const titleSize = isCompact ? 35 : 46
  const titleLineHeight = isCompact ? 42 : 52
  const bodySize = isCompact ? 16 : 18
  const bodyLineHeight = isCompact ? 28 : 32

  useEffect(() => {
    void preloadBirthCityAutocomplete()
  }, [])

  useEffect(() => {
    if (step !== 3 || !focusTimeAfterStep3Ref.current) return
    focusTimeAfterStep3Ref.current = false
    timeInputRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmedQuery = cityQuery.trim()

    if (trimmedQuery.length < 2) {
      setCityResults([])
      setSearchState('idle')
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
      }
    }

    setSearchState('loading')
    debounceRef.current = setTimeout(() => {
      const requestId = ++searchRequestIdRef.current

      void searchBirthCities(trimmedQuery, {
        limit: 3,
        includeMapbox: true,
        mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
      }).then((results) => {
        if (requestId === searchRequestIdRef.current) {
          setCityResults(results)
          setSearchState(results.length > 0 ? 'ready' : 'empty')
        }
      }).catch(() => {
        if (requestId === searchRequestIdRef.current) {
          setCityResults([])
          setSearchState('error')
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
  const missingRequirements = [
    !birthdayIso ? 'birthday' : null,
    !selectedGeo ? 'birth city' : null,
    timeKnown && !time ? 'birth time' : null,
  ].filter((value): value is string => Boolean(value))

  const handleCitySelect = (result: GeoResult) => {
    setSelectedGeo(result)
    setCityQuery(result.place_name)
    setShowResults(false)
    setSearchState('ready')
  }

  const handleSubmit = async () => {
    setShowSubmitErrors(true)
    setSubmitError(null)
    if (!birthdayIso || !selectedGeo || (timeKnown && !time) || isSubmitting) return

    setIsSubmitting(true)

    try {
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
    } catch (error) {
      console.error('Failed to build onboarding map', error)
      setSubmitError('We could not build your map right now. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitHint = missingRequirements.length > 0
    ? `To continue, add your ${missingRequirements.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
    : 'You are ready to build your map.'

  return (
    <MobileScrollScreen contentContainerStyle={styles.content} extraBottomInset={40}>
      <View style={[styles.shell, isCompact ? styles.shellCompact : null]}>
        <View style={[styles.header, isNarrow ? styles.headerCompact : null]}>
          <View style={styles.brandRow}>
            <Image
              accessibilityIgnoresInvertColors
              source={VIBE_TRAVEL_LOGO}
              style={styles.brandMark}
            />
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start setup"
              accessibilityHint="Begin the onboarding flow."
              style={styles.primaryButton}
              onPress={() => setStep(2)}
            >
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
                  accessibilityLabel="Birth day"
                  accessibilityHint="Enter the day part of your birthday."
                  autoComplete="birthdate-day"
                  keyboardType="number-pad"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => monthInputRef.current?.focus()}
                  style={[styles.input, styles.birthdayInput, styles.centerText]}
                />
                <TextInput
                  ref={monthInputRef}
                  value={birthMonth}
                  onChangeText={(value) => setBirthMonth(digitsOnly(value).slice(0, 2))}
                  placeholder="MM"
                  accessibilityLabel="Birth month"
                  accessibilityHint="Enter the month part of your birthday."
                  autoComplete="birthdate-month"
                  keyboardType="number-pad"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => yearInputRef.current?.focus()}
                  style={[styles.input, styles.birthdayInput, styles.centerText]}
                />
                <TextInput
                  ref={yearInputRef}
                  value={birthYear}
                  onChangeText={(value) => setBirthYear(digitsOnly(value).slice(0, 4))}
                  placeholder="YYYY"
                  accessibilityLabel="Birth year"
                  accessibilityHint="Enter the year part of your birthday."
                  autoComplete="birthdate-year"
                  keyboardType="number-pad"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    setShowBirthdayErrors(true)
                    if (!birthdayError) {
                      focusTimeAfterStep3Ref.current = true
                      setStep(3)
                    }
                  }}
                  style={[styles.input, styles.birthdayInput, styles.centerText]}
                />
              </View>
              {showBirthdayErrors && birthdayError ? <Text style={styles.errorText}>{birthdayError}</Text> : null}
            </View>

            <View style={[styles.actionRow, isCompact ? styles.actionColumn : null]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                accessibilityHint="Return to the previous onboarding step."
                style={[styles.secondaryButton, !isCompact ? styles.secondaryFixed : null]}
                onPress={() => setStep(1)}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue"
                accessibilityHint="Move to the birth time and city step."
                style={styles.primaryButton}
                onPress={() => {
                  setShowBirthdayErrors(true)
                  if (!birthdayError) {
                    focusTimeAfterStep3Ref.current = true
                    setStep(3)
                  }
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
                ref={timeInputRef}
                value={time}
                onChangeText={setTime}
                placeholder="12:00"
                accessibilityLabel="Birth time"
                accessibilityHint="Enter your birth time, or choose the checkbox below if you do not know it."
                autoComplete="off"
                autoCapitalize="none"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => cityInputRef.current?.focus()}
                editable={timeKnown}
                style={[styles.input, !timeKnown ? styles.inputDisabled : null]}
              />

              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="I do not know my birth time"
                accessibilityHint="Use 12:00 PM as the default birth time."
                accessibilityState={{ checked: !timeKnown }}
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
                ref={cityInputRef}
                value={cityQuery}
                onChangeText={(value) => {
                  setCityQuery(value)
                  setSelectedGeo(null)
                  setShowResults(true)
                  setSubmitError(null)
                }}
                onFocus={() => setShowResults(true)}
                placeholder="Search for your birth city"
                accessibilityLabel="Birth city search"
                accessibilityHint="Type at least two letters to search for your birth city and choose a suggestion."
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => setShowResults(true)}
                style={styles.input}
              />

              {showResults && searchState === 'loading' ? (
                <View style={styles.resultsList}>
                  <View style={styles.resultRow}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.resultStatusText}>Searching cities...</Text>
                  </View>
                </View>
              ) : null}

              {showResults && searchState === 'error' ? (
                <View style={styles.resultsList}>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultStatusText}>Search is temporarily unavailable. Try again in a moment.</Text>
                  </View>
                </View>
              ) : null}

              {showResults && searchState === 'empty' ? (
                <View style={styles.resultsList}>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultStatusText}>No city matches found. Try a nearby city or different spelling.</Text>
                  </View>
                </View>
              ) : null}

              {showResults && searchState === 'ready' && cityResults.length > 0 ? (
                <View style={styles.resultsList}>
                  {cityResults.slice(0, 3).map((result, index) => {
                    const selected = selectedGeo?.place_name === result.place_name
                    return (
                      <Pressable
                        key={`${result.place_name}-${index}`}
                        onPress={() => handleCitySelect(result)}
                        accessibilityRole="button"
                        accessibilityLabel={result.place_name}
                        accessibilityHint="Select this city as your birth city."
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
              {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
            </View>

            <View style={[styles.actionRow, isCompact ? styles.actionColumn : null]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                accessibilityHint="Return to the birthday step."
                style={[styles.secondaryButton, !isCompact ? styles.secondaryFixed : null]}
                onPress={() => setStep(2)}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Build my map"
                accessibilityHint={missingRequirements.length > 0 ? submitHint : 'Build your map and continue to the globe.'}
                style={[styles.primaryButton, isSubmitting ? styles.primaryButtonDisabled : null]}
                disabled={isSubmitting}
                onPress={() => void handleSubmit()}
              >
                {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Build my map</Text>}
              </Pressable>
            </View>
            <Text style={styles.helperText}>{submitHint}</Text>
          </View>
        ) : null}
      </View>
    </MobileScrollScreen>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
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
  headerCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  brandMark: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
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
    gap: 10,
  },
  resultsList: {
    overflow: 'hidden',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.popover,
    maxHeight: 220,
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
  resultStatusText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
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
