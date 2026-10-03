import type { ContentManifest } from './types'

const LOCAL_MANIFEST_URL = '/content/manifest.json'

export async function fetchLocalManifest(): Promise<ContentManifest> {
  const res = await fetch(LOCAL_MANIFEST_URL)
  if (!res.ok) throw new Error(`No se pudo cargar manifest local (${res.status})`)
  return res.json()
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
