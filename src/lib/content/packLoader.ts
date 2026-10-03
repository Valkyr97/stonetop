import { supabase } from '../supabase'
import { getMeta, getPack, listPacks, savePack, setMeta } from '../db/idb'
import { fetchLocalManifest, sha256Hex } from './manifest'
import type { ArcanaPack, ContentManifest, CreationPack, ManifestPack } from './types'

const BUCKET = 'content-packs'

async function fetchPackBytes(file: string): Promise<ArrayBuffer> {
  // Prefer local public/content (offline-first). Storage is optional upgrade path.
  const local = await fetch(`/content/${file}`)
  if (local.ok) return local.arrayBuffer()

  const { data, error } = await supabase.storage.from(BUCKET).download(file)
  if (error || !data) throw new Error(error?.message ?? `Pack no encontrado: ${file}`)
  return data.arrayBuffer()
}

async function loadOnePack(pack: ManifestPack) {
  const existing = await getPack(pack.id)
  if (existing?.sha256 === pack.sha256 && existing.version === pack.version) {
    return existing
  }

  const bytes = await fetchPackBytes(pack.file)
  const hash = await sha256Hex(bytes)
  if (hash !== pack.sha256) {
    console.warn(`Hash mismatch for ${pack.id}: expected ${pack.sha256}, got ${hash}`)
  }

  const text = new TextDecoder().decode(bytes)
  const data = JSON.parse(text)
  const cached = {
    id: pack.id,
    version: pack.version,
    sha256: hash,
    data,
    cachedAt: new Date().toISOString(),
  }
  await savePack(cached)
  return cached
}

export async function ensureContentPacks(opts?: { includeOptional?: boolean }) {
  const includeOptional = opts?.includeOptional ?? true
  const manifest = await fetchLocalManifest()
  await setMeta('manifest', manifest)

  const wanted = manifest.packs.filter((p) => p.required || includeOptional)
  for (const pack of wanted) {
    await loadOnePack(pack)
  }

  await setMeta('content_version', manifest.version)
  return manifest
}

export async function getCreationPack(): Promise<CreationPack> {
  // Always reconcile with the on-disk manifest so rule_text ingest updates
  // are not stuck behind a stale IndexedDB cache.
  await ensureContentPacks({ includeOptional: false })
  const pack = await getPack<CreationPack>('creation')
  if (!pack) throw new Error('Pack creation no disponible')
  return pack.data
}

export async function getArcanaPack(): Promise<ArcanaPack | null> {
  try {
    await ensureContentPacks({ includeOptional: true })
  } catch {
    // optional pack
  }
  const pack = await getPack<ArcanaPack>('arcana')
  return pack?.data ?? null
}

export async function getCachedManifest(): Promise<ContentManifest | undefined> {
  return getMeta<ContentManifest>('manifest')
}

export async function contentStatus() {
  const manifest = (await getCachedManifest()) ?? (await fetchLocalManifest())
  const packs = await listPacks()
  const byId = new Map(packs.map((p) => [p.id, p]))
  return {
    version: manifest.version,
    packs: manifest.packs.map((p) => ({
      ...p,
      cached: !!byId.get(p.id),
      cachedVersion: byId.get(p.id)?.version,
      hashMatch: byId.get(p.id)?.sha256 === p.sha256,
    })),
  }
}
