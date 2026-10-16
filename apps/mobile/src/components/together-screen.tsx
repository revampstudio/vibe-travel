import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'expo-router'
import { Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '@/src/store/useStore'
import { chartShareMessage, createSharedChart, decodeChart, encodeChart, sharedChartLines } from '@/src/lib/chartSharing'
import { compareCharts, distinctLines, type ComparisonPurpose } from '@/src/lib/compareCharts'
import { computeChartGeometry } from '@/src/lib/astrocartography'
import { getInterpretation, ASTROLOGY_CONTEXT } from '@/src/lib/interpretations'
import { enrichCitiesWithEnergy } from '@/src/lib/geo'
import { loadCities } from '@/src/data/loadCities'
import { ShareMapImage } from './share-map-image'
import { useBirthTimeZone } from './birth-time-zone'
import { searchBirthCities, type GeoResult } from '@/src/lib/birthCityAutocomplete'
import { WorldMapCard } from './world-map-card'
import { colors, fonts } from '@/src/theme'
import type { City, CityWithEnergy } from '@/src/types'

const EMPTY_LINES: never[] = []
function Action({ title, onPress, secondary = false }: { title: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, secondary && styles.secondary]}><Text style={[styles.buttonText, secondary && { color: colors.text }]}>{title}</Text></Pressable>
}
export function TogetherScreen() {
  const scroll = useRef<ScrollView>(null)
  const mapY = useRef(0)
  const birth = useStore(s => s.birthData)
  const ownLines = useStore(s => s.astroLines)
  const companion = useStore(s => s.companionChart)
  const setCompanion = useStore(s => s.setCompanionChart)
  const showCompanion = useStore(s => s.showCompanion)
  const setShowCompanion = useStore(s => s.setShowCompanion)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [shareStatus, setShareStatus] = useState('')
  const [source, setSource] = useState<City[]>([])
  const [purpose, setPurpose] = useState<ComparisonPurpose>('travel')
  const [manual, setManual] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [birthCityQuery, setBirthCityQuery] = useState('')
  const [birthCity, setBirthCity] = useState<GeoResult | null>(null)
  const [birthCityResults, setBirthCityResults] = useState<GeoResult[]>([])
  const zone = useBirthTimeZone(date, time, birthCity)
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (birthCity || birthCityQuery.trim().length < 2) { setBirthCityResults([]); return }
      void searchBirthCities(birthCityQuery, { limit: 4, includeMapbox: true, mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN }).then(results => { if (!cancelled) setBirthCityResults(results) })
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [birthCityQuery, birthCity])
  const [selected, setSelected] = useState<CityWithEnergy | null>(null)
  const insets = useSafeAreaInsets()
  useEffect(() => { void loadCities().then(setSource).catch(() => setError('Cities could not load. Please reopen this screen.')) }, [])
  const ownChart = useMemo(() => birth && birth.utcOffsetMinutes !== undefined ? createSharedChart(birth) : null, [birth])
  const friendLines = useMemo(() => companion ? sharedChartLines(companion) : EMPTY_LINES, [companion])
  const mainLines = ownChart ? ownLines : friendLines
  const mapCities = useMemo(() => enrichCitiesWithEnergy(source, mainLines), [source, mainLines])
  const suggestions = useMemo(() => ownChart && companion ? compareCharts(source, ownLines, friendLines, purpose) : [], [source, ownChart, companion, ownLines, friendLines, purpose])
  const selectedFriend = useMemo(() => selected ? enrichCitiesWithEnergy([selected], friendLines)[0] : null, [selected, friendLines])
  async function shareCode() {
    if (!ownChart) return
    setShareStatus('')
    try {
      const message = chartShareMessage(ownChart)
      if (Platform.OS === 'web') {
        if (navigator.share) await navigator.share({ text: message, title: 'My Vibe Travel chart' })
        else if (navigator.clipboard) { await navigator.clipboard.writeText(message); setShareStatus('Chart code copied. Paste it into a message for your friend.') }
        else setShareStatus('Select and copy the chart code below.')
      } else await Share.share({ message, title: 'My Vibe Travel chart' })
    } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setShareStatus('Sharing is unavailable. Select and copy the chart code below.') }
  }
  function importChart() {
    setError('')
    try { setCompanion(decodeChart(code)); setCode(''); setSelected(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not read this chart.') }
  }
  function calculateCompanion() {
    setError('')
    try {
      const utcOffset = zone.offsetMinutes
      if (utcOffset === null) throw new Error('Choose a birth city and resolve any time-zone message.')
      setCompanion({ version: 1, geometry: computeChartGeometry(date, time, utcOffset), approximate: false })
      setDate(''); setTime(''); setBirthCityQuery(''); setBirthCity(null); setManual(false); setSelected(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Check the birth details.') }
  }
  return <ScrollView ref={scroll} style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
    <Link href="/" style={styles.back}>‹ Back to my map</Link>
    <Text style={styles.title}>Share & compare</Text>
    <Text style={styles.body}>Explore a friend’s map, overlay your planetary lines and discover places to experience together.</Text>
    {ownChart ? <View style={styles.card}>
      <Text style={styles.heading}>Send your map to a friend</Text>
      <Text style={styles.body}>The image is readable without the app. The chart code lets a friend open your lines in Vibe Travel and compare them with their own.</Text>
      <Text style={styles.small}>Your name, birth date, birth time and birth city are omitted. The image and code still contain personal chart positions; share only with people you trust.</Text>
      {ownChart.approximate ? <Text style={styles.warning}>Your chart is approximate: the birth time is unknown or the UTC offset is unconfirmed. Review Settings before sharing precise lines.</Text> : null}
      <ShareMapImage lines={ownLines} approximate={ownChart.approximate} />
      <Action title="Share chart code" onPress={() => void shareCode()} secondary />
      <Text selectable style={styles.code}>{encodeChart(ownChart)}</Text>
      {shareStatus ? <Text accessibilityLiveRegion="polite" style={styles.body}>{shareStatus}</Text> : null}
    </View> : <View style={styles.card}><Text style={styles.heading}>{birth ? 'Confirm your saved birth time' : 'Received a map?'}</Text><Text style={styles.body}>{birth ? 'Review your birth time and historical time zone in Settings before sharing or comparing your own map. You can still open a friend’s chart below.' : 'Paste your friend’s chart code below to view their map. You can create your own map later to compare.'}</Text><Link href="/" style={styles.back}>{birth ? 'Review my map settings' : 'Create my map'}</Link></View>}
    <View style={styles.card}>
      <Text style={styles.heading}>{companion ? 'Replace companion chart' : 'Add a companion chart'}</Text>
      <Text style={styles.body}>Ask your friend to choose “Share chart code”, then paste their VTM1 code here. Imported charts stay in this session only and never replace your own birth profile.</Text>
      <TextInput accessibilityLabel="Companion chart code" multiline autoCapitalize="none" autoCorrect={false} placeholder="Paste VTM1:…" value={code} onChangeText={setCode} style={[styles.input, { minHeight: 90 }]} />
      <Action title="Open shared chart" onPress={importChart} />
      <Action title={manual ? 'Cancel birth details' : 'Or enter their birth details'} onPress={() => { setManual(!manual); setError('') }} secondary />
      {manual ? <View style={{ gap: 12 }}>
        <Text style={styles.body}>Use details your companion has agreed to share. Only their calculated chart is kept in this session. Their date and time are cleared after calculation. The birth city sets the historical time zone automatically.</Text>
        <TextInput accessibilityLabel="Companion birth date" placeholder="Birth date · YYYY-MM-DD" autoCapitalize="none" value={date} onChangeText={setDate} style={styles.input} />
        <TextInput accessibilityLabel="Companion birth time" placeholder="Local birth time · HH:MM (24-hour)" autoCapitalize="none" value={time} onChangeText={setTime} style={styles.input} />
        <TextInput accessibilityLabel="Companion birth city" placeholder="Search their birth city" value={birthCityQuery} onChangeText={value => { setBirthCityQuery(value); setBirthCity(null) }} style={styles.input} />
        {birthCityResults.map(result => <Action key={result.place_name} title={result.place_name} onPress={() => { setBirthCity(result); setBirthCityQuery(result.place_name); setBirthCityResults([]) }} secondary />)}
        {zone.control}
        <Action title="Calculate companion chart" onPress={calculateCompanion} />
      </View> : null}
      {error ? <Text accessibilityRole="alert" style={styles.warning}>{error}</Text> : null}
    </View>
    {companion ? <>
      <View onLayout={event => { mapY.current = event.nativeEvent.layout.y }} style={styles.card}>
        <Text style={styles.heading}>{ownChart ? 'Your maps together' : 'Your friend’s map'}</Text>
        {ownChart ? <View style={styles.row}><Text style={[styles.body, { flex: 1 }]}>Show companion overlay</Text><Switch accessibilityLabel="Show companion overlay" value={showCompanion} onValueChange={setShowCompanion} /></View> : null}
        <Text style={styles.small}>{ownChart ? 'You: planetary colours. Companion: navy dashed lines. The planet colours are listed on the share image; tap a city to read each person’s influences.' : 'Planetary colours show your friend’s lines. Tap a city to read the influences.'}</Text>
        {companion.approximate ? <Text style={styles.warning}>This shared chart is approximate. Unknown time or an unconfirmed time zone can substantially shift the lines.</Text> : null}
        <View style={styles.map}><WorldMapCard displayLines={mainLines} displayCities={mapCities} otherLines={ownChart && showCompanion ? friendLines : EMPTY_LINES} onCityPress={setSelected} /></View>
        {selected ? <View style={{ gap: 10 }}><Text style={styles.heading}>{selected.name}, {selected.country}</Text>{[{ label: ownChart ? 'You' : 'Companion', city: selected }, ...(ownChart && selectedFriend ? [{ label: 'Companion', city: selectedFriend }] : [])].map(person => <View key={person.label} style={{ gap: 8 }}><Text style={styles.heading}>{person.label}</Text>{distinctLines(person.city.activeLines).length ? distinctLines(person.city.activeLines).map(line => <View key={`${line.planet}-${line.lineType}`} style={{ gap: 5 }}><Text style={styles.bold}>{line.planet} · {line.lineType}</Text><Text style={styles.body}>{getInterpretation(line.planet, line.lineType)}</Text></View>) : <Text style={styles.body}>No lines within the app’s nearby-line range here. This does not mean the place is unsuitable.</Text>}</View>)}</View> : null}
        <ShareMapImage lines={mainLines} companion={ownChart && showCompanion ? friendLines : EMPTY_LINES} approximate={Boolean(ownChart?.approximate || companion.approximate)} />
        <Action title="Remove companion chart" onPress={() => { setCompanion(null); setSelected(null) }} secondary />
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>How to read two charts</Text>
        <Text style={styles.body}>{ASTROLOGY_CONTEXT}</Text>
        <Text style={styles.body}>The same place can bring up different themes for each person. Read both descriptions and discuss your needs. Overlapping lines do not measure relationship compatibility.</Text>
      </View>
      {ownChart ? <View style={styles.card}>
        <Text style={styles.heading}>Places to explore together</Text>
        <View style={styles.row}>{(['travel', 'live'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: purpose === value }} onPress={() => setPurpose(value)} style={[styles.tab, purpose === value && styles.tabActive]}><Text style={[styles.bold, purpose === value && { color: 'white' }]}>{value === 'travel' ? 'Travel together' : 'Live together'}</Text></Pressable>)}</View>
        <Text style={styles.body}>{purpose === 'travel' ? 'This lens gives extra emphasis to ASC and DSC themes: new experiences, identity and encounters.' : 'This lens gives extra emphasis to IC and DSC themes: home, roots and shared daily life. It is a starting point for a relocation conversation, not a verdict on where to move.'}</Text>
        <Text style={styles.small}>Suggestions require nearby lines for both people. We rank the weaker of the two proximity signals so one chart cannot dominate. Known bundled Level 3–4 advisory destinations are excluded; check current official advice, visa rules, housing and practical needs separately.</Text>
        {source.length === 0 ? <Text style={styles.body}>Loading cities…</Text> : suggestions.length === 0 ? <Text style={styles.body}>No shared places were found within our nearby-line range. This is not a compatibility result. Explore either map and compare places you already have in mind.</Text> : suggestions.map(({ city, companion: other }) => <View key={`${city.name}-${city.country}`} style={styles.place}>
          <Text style={styles.heading}>{city.name}, {city.country}</Text>
          {[{ label: 'You', value: city }, { label: 'Companion', value: other }].map(person => <View key={person.label} style={{ gap: 6 }}><Text style={styles.bold}>{person.label}: {distinctLines(person.value.activeLines).map(line => `${line.planet} ${line.lineType}`).join(' · ')}</Text>{distinctLines(person.value.activeLines).slice(0, 2).map(line => <Text key={`${line.planet}-${line.lineType}`} style={styles.body}>{getInterpretation(line.planet, line.lineType).split('\n\n')[0]}</Text>)}</View>)}
          <Action title={`Explore ${city.name} on both maps`} onPress={() => { setSelected(city); useStore.getState().setSelectedCity(city); scroll.current?.scrollTo({ y: mapY.current, animated: true }) }} secondary />
        </View>)}
      </View> : null}
    </> : null}
  </ScrollView>
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 18, gap: 18, width: '100%', maxWidth: 840, alignSelf: 'center' }, back: { color: colors.accentStrong, fontWeight: '700', paddingVertical: 8 }, title: { fontSize: 32, fontFamily: fonts.serif, color: colors.text }, heading: { fontSize: 20, fontWeight: '700', color: colors.text }, body: { fontSize: 15, lineHeight: 23, color: colors.text }, small: { fontSize: 13, lineHeight: 20, color: colors.muted }, bold: { fontSize: 14, fontWeight: '700', color: colors.text }, card: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 14, borderWidth: 1, borderColor: colors.border }, button: { backgroundColor: colors.accentStrong, borderRadius: 12, padding: 15 }, secondary: { backgroundColor: colors.surfaceSoft }, buttonText: { color: 'white', fontWeight: '700', textAlign: 'center' }, input: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong, fontSize: 16, color: colors.text }, code: { fontSize: 12, lineHeight: 18, color: colors.muted }, warning: { fontSize: 14, lineHeight: 21, color: colors.danger }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, map: { height: 340, overflow: 'hidden', borderRadius: 14 }, tab: { padding: 12, borderRadius: 12, backgroundColor: colors.surfaceSoft, flex: 1 }, tabActive: { backgroundColor: colors.accentStrong }, place: { gap: 14, borderTopWidth: 1, borderColor: colors.border, paddingTop: 20 },
})
