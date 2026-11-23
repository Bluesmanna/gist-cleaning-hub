// Save a file: a normal download on the web; on Android the file is written to the app's
// documents folder and handed to the share sheet (save to Drive/Files, email, etc.).
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] || '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })
}

export async function saveBlob(blob: Blob, filename: string) {
  if (Capacitor.isNativePlatform()) {
    const data = await blobToBase64(blob)
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Documents, recursive: true }).catch(() =>
      Filesystem.writeFile({ path: filename, data, directory: Directory.Cache }),
    )
    await Share.share({ title: filename, url: res.uri, dialogTitle: `Save ${filename}` }).catch(() => undefined)
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function saveUrl(url: string, filename: string) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Download failed (${r.status})`)
  await saveBlob(await r.blob(), filename)
}

export function saveText(text: string, filename: string, type = 'text/plain') {
  return saveBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename)
}

export function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type })
}

export function fileToDataUrl(f: File, maxW = 1280): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onerror = () => rej(r.error)
    r.onload = () => {
      const url = String(r.result)
      if (!f.type.startsWith('image/')) return res(url)
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        res(c.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = () => res(url)
      img.src = url
    }
    r.readAsDataURL(f)
  })
}
