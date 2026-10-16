import { useMemo, useRef, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import Svg, { SvgXml } from 'react-native-svg'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { mapPostcardSvg } from '@/src/lib/mapPostcard'
import type { AstroLine } from '@/src/types'
import { colors } from '@/src/theme'

export function ShareMapImage({ lines, companion = [], approximate = false }: { lines: AstroLine[]; companion?: AstroLine[]; approximate?: boolean }) {
  const ref = useRef<Svg>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const xml = useMemo(() => mapPostcardSvg(lines, companion, approximate), [lines, companion, approximate])
  async function share() {
    setBusy(true); setStatus('')
    try {
      if (Platform.OS === 'web') {
        const img = new Image()
        const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
        try {
          await new Promise<void>((resolve,reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = url })
          const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 1020
          const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image export unavailable')
          ctx.drawImage(img, 0, 0)
          const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image export failed')), 'image/png'))
          const file = new File([blob], 'vibe-travel-map.png', { type: 'image/png' })
          if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Vibe Travel astrocartography map' })
          else {
            const download = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = download; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(download), 1000)
            setStatus('Map image downloaded. You can send it to a friend.')
          }
        } finally { URL.revokeObjectURL(url) }
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device')
        const data = await new Promise<string>((resolve,reject) => {
          const timer = setTimeout(() => reject(new Error('Image export timed out')), 10000)
          if (!ref.current) { clearTimeout(timer); reject(new Error('Map is still loading')); return }
          ref.current.toDataURL(value => { clearTimeout(timer); resolve(value) }, { width: 1440, height: 1020 })
        })
        const uri = FileSystem.cacheDirectory + 'vibe-travel-map.png'
        await FileSystem.writeAsStringAsync(uri, data, { encoding: FileSystem.EncodingType.Base64 })
        try { await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your astrocartography map' }) }
        finally { await FileSystem.deleteAsync(uri, { idempotent: true }) }
      }
    } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setStatus('Could not share the image. Please try again, or share the chart code below.') }
    finally { setBusy(false) }
  }
  return <View style={{ gap: 12 }}>
    <SvgXml xml={xml} override={{ ref, width: '100%', height: 250 }} />
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void share()} style={{ backgroundColor: colors.accentStrong, padding: 15, borderRadius: 12 }}><Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>{busy ? 'Preparing image…' : 'Share map image'}</Text></Pressable>
    {status ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>{status}</Text> : null}
  </View>
}
