import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputProps,
} from 'react-native'

import { colors, fonts, radii } from '@/src/theme'

export type TimeInputHandle = {
  focus: () => void
}

export type TimeInputProps = {
  value: string
  onChange: (time: string) => void
  label?: string
  disabled?: boolean
  compact?: boolean
  hoursAccessibilityLabel?: string
  minutesAccessibilityLabel?: string
} & Pick<TextInputProps, 'returnKeyType' | 'onSubmitEditing'>

const pad = (value: string | number) => String(value).padStart(2, '0')

const parseTime = (time: string) => {
  const [h, m] = time.split(':')
  return { hours: h ?? '', minutes: m ?? '' }
}

const clampHours = (value: string) => {
  const n = Number(value)
  if (Number.isNaN(n)) return '00'
  if (n > 23) return '23'
  return pad(value)
}

const clampMinutes = (value: string) => {
  const n = Number(value)
  if (Number.isNaN(n)) return '00'
  if (n > 59) return '59'
  return pad(value)
}

export const TimeInput = forwardRef<TimeInputHandle, TimeInputProps>(
  (
    {
      value,
      onChange,
      label = 'Time',
      disabled = false,
      compact = false,
      hoursAccessibilityLabel = 'Hours',
      minutesAccessibilityLabel = 'Minutes',
      returnKeyType,
      onSubmitEditing,
    },
    ref,
  ) => {
    const initial = parseTime(value)
    const [hours, setHours] = useState(initial.hours)
    const [minutes, setMinutes] = useState(initial.minutes)
    const hoursRef = useRef<TextInput>(null)
    const minutesRef = useRef<TextInput>(null)
    const lastEmittedRef = useRef(value)

    const emitChange = (h: string, m: string) => {
      const next = `${pad(h)}:${pad(m)}`
      lastEmittedRef.current = next
      onChange(next)
    }

    useEffect(() => {
      if (value === lastEmittedRef.current) return
      lastEmittedRef.current = value
      const next = parseTime(value)
      setHours(next.hours)
      setMinutes(next.minutes)
    }, [value])

    useImperativeHandle(ref, () => ({
      focus: () => hoursRef.current?.focus(),
    }))

    const handleHoursChange = (raw: string) => {
      const cleaned = raw.replace(/\D/g, '').slice(0, 2)
      setHours(cleaned)
      emitChange(cleaned, minutes)

      if (cleaned.length === 2) {
        minutesRef.current?.focus()
      }
    }

    const handleMinutesChange = (raw: string) => {
      const cleaned = raw.replace(/\D/g, '').slice(0, 2)
      setMinutes(cleaned)
      emitChange(hours, cleaned)
    }

    const handleHoursBlur = () => {
      const normalized = clampHours(hours)
      setHours(normalized)
      emitChange(normalized, minutes)
    }

    const handleMinutesBlur = () => {
      const normalized = clampMinutes(minutes)
      setMinutes(normalized)
      emitChange(hours, normalized)
    }

    const handleMinutesKeyPress = (
      event: NativeSyntheticEvent<TextInputKeyPressEventData>,
    ) => {
      if (event.nativeEvent.key === 'Backspace' && minutes.length === 0) {
        hoursRef.current?.focus()
      }
    }

    const handleHoursSubmit = () => {
      if (hours.length === 2) {
        minutesRef.current?.focus()
      }
    }

    return (
      <View accessibilityLabel={label} style={styles.container}>
        <View style={[styles.row, compact ? styles.rowCompact : null, disabled ? styles.rowDisabled : null]}>
          <TextInput
            ref={hoursRef}
            accessibilityLabel={hoursAccessibilityLabel}
            accessibilityHint="Enter the hour, 00 to 23."
            autoComplete="off"
            autoCorrect={false}
            editable={!disabled}
            keyboardType="number-pad"
            maxLength={2}
            onBlur={handleHoursBlur}
            onChangeText={handleHoursChange}
            onSubmitEditing={handleHoursSubmit}
            placeholder="00"
            returnKeyType="next"
            selectTextOnFocus
            style={[
              styles.input,
              compact ? styles.inputCompact : null,
              disabled ? styles.inputDisabled : null,
              styles.hoursInput,
            ]}
            value={hours}
          />
          <Text style={[styles.separator, compact ? styles.separatorCompact : null, disabled ? styles.separatorDisabled : null]}>:</Text>
          <TextInput
            ref={minutesRef}
            accessibilityLabel={minutesAccessibilityLabel}
            accessibilityHint="Enter the minutes, 00 to 59."
            autoComplete="off"
            autoCorrect={false}
            editable={!disabled}
            keyboardType="number-pad"
            maxLength={2}
            onBlur={handleMinutesBlur}
            onChangeText={handleMinutesChange}
            onKeyPress={handleMinutesKeyPress}
            onSubmitEditing={onSubmitEditing}
            placeholder="00"
            returnKeyType={returnKeyType ?? 'done'}
            selectTextOnFocus
            style={[
              styles.input,
              compact ? styles.inputCompact : null,
              disabled ? styles.inputDisabled : null,
              styles.minutesInput,
            ]}
            value={minutes}
          />
        </View>
      </View>
    )
  },
)

TimeInput.displayName = 'TimeInput'

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    minHeight: 54,
    maxWidth: 140,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    boxShadow: '0 1px 2px rgba(17, 24, 39, 0.04)',
  },
  rowCompact: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 12,
  },
  rowDisabled: {
    borderColor: 'rgba(227, 230, 235, 0.7)',
    backgroundColor: colors.surfaceSoft,
  },
  input: {
    width: 38,
    minHeight: 54,
    paddingHorizontal: 0,
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  inputCompact: {
    width: 34,
    minHeight: 48,
    fontSize: 18,
  },
  inputDisabled: {
    color: 'rgba(95, 103, 119, 0.55)',
  },
  hoursInput: {
    textAlign: 'right',
  },
  minutesInput: {
    textAlign: 'left',
  },
  separator: {
    width: 8,
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: '600',
    color: colors.muted,
  },
  separatorCompact: {
    width: 6,
    fontSize: 18,
  },
  separatorDisabled: {
    color: 'rgba(95, 103, 119, 0.45)',
  },
})
