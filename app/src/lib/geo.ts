// Geofenced clock-in. GIST only pays on-site time, so the clock checks the device's
// location against the client's home before letting someone clock in. In the demo,
// "Simulate on-site" (Settings) places you at the client so testers anywhere can try it.
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

export interface Fix {
  lat: number
  lng: number
  accuracy: number
  simulated?: boolean
}

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const toR = (x: number) => (x * Math.PI) / 180
  const dLat = toR(b.lat - a.lat)
  const dLng = toR(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export async function currentFix(): Promise<Fix> {
  if (Capacitor.isNativePlatform()) {
    await Geolocation.requestPermissions().catch(() => undefined)
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })
    return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser has no location support.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.message || 'Location permission denied.')),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  })
}

/** Location check for a clock-in/out at `target`. */
export async function checkSite(target: { lat: number; lng: number }, radius: number, simulate: boolean) {
  if (simulate) {
    const fix: Fix = { lat: target.lat + 0.0002, lng: target.lng - 0.0001, accuracy: 12, simulated: true }
    return { fix, distance: Math.round(distanceM(fix, target)), onSite: true }
  }
  const fix = await currentFix()
  const distance = Math.round(distanceM(fix, target))
  return { fix, distance, onSite: distance <= radius + Math.min(fix.accuracy, 75) }
}

export const mapsLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
