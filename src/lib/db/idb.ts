import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface CachedPack {
  id: string
  version: string
  sha256: string
  data: unknown
  cachedAt: string
}

export interface LocalCharacterClaim {
  characterId: string
  campaignId: string
  campaignName: string
  claimSecret: string
}

export interface LocalCharacterDraft {
  /** Local id before claiming; becomes the server character id once claimed. */
  id: string
  playbookId: string
  state: Record<string, unknown>
  contentVersion: string | null
  dirty: boolean
  updatedAt: string
  /** Denormalized from state.identity.character_name, for roster listing. */
  name?: string
  /** Present once the character has been linked to a GM campaign. */
  claim?: LocalCharacterClaim | null
  /** Soft-delete timestamp; roster hides drafts with this set. */
  deletedAt?: string | null
}

export interface LocalGrant {
  id: string
  character_id: string
  content_type: string
  content_id: string
  visibility: string
  granted_at: string
}

export interface LocalArcanaState {
  id: string
  grant_id: string
  character_id: string
  unlocked: boolean
  progress: Record<string, unknown>
  consequences: unknown[]
  state: Record<string, unknown>
  dirty: boolean
  updatedAt: string
}

interface StonetopDB extends DBSchema {
  packs: {
    key: string
    value: CachedPack
  }
  meta: {
    key: string
    value: { key: string; value: unknown }
  }
  characters: {
    key: string
    value: LocalCharacterDraft
  }
  grants: {
    key: string
    value: LocalGrant
    indexes: { 'by-character': string }
  }
  arcanaState: {
    key: string
    value: LocalArcanaState
    indexes: { 'by-character': string; 'by-grant': string }
  }
}

let dbPromise: Promise<IDBPDatabase<StonetopDB>> | null = null

/** IndexedDB uses structured clone, which cannot store Svelte 5 `$state` proxies. */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<StonetopDB>('stonetop', 1, {
      upgrade(db) {
        db.createObjectStore('packs', { keyPath: 'id' })
        db.createObjectStore('meta', { keyPath: 'key' })
        db.createObjectStore('characters', { keyPath: 'id' })
        const grants = db.createObjectStore('grants', { keyPath: 'id' })
        grants.createIndex('by-character', 'character_id')
        const arcana = db.createObjectStore('arcanaState', { keyPath: 'id' })
        arcana.createIndex('by-character', 'character_id')
        arcana.createIndex('by-grant', 'grant_id')
      },
    })
  }
  return dbPromise
}

export async function savePack(pack: CachedPack) {
  const db = await getDb()
  await db.put('packs', toPlain(pack))
}

export async function getPack<T = unknown>(id: string): Promise<CachedPack & { data: T } | undefined> {
  const db = await getDb()
  return (await db.get('packs', id)) as CachedPack & { data: T } | undefined
}

export async function listPacks() {
  const db = await getDb()
  return db.getAll('packs')
}

export async function setMeta(key: string, value: unknown) {
  const db = await getDb()
  await db.put('meta', toPlain({ key, value }))
}

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDb()
  const row = await db.get('meta', key)
  return row?.value as T | undefined
}

export async function saveCharacterDraft(draft: LocalCharacterDraft) {
  const db = await getDb()
  await db.put('characters', toPlain(draft))
}

export async function getCharacterDraft(id: string) {
  const db = await getDb()
  return db.get('characters', id)
}

export async function listCharacterDrafts() {
  const db = await getDb()
  return db.getAll('characters')
}

/** Active (non-deleted) drafts for the Home roster. */
export async function listActiveCharacterDrafts() {
  const all = await listCharacterDrafts()
  return all.filter((d) => !d.deletedAt)
}

export async function deleteCharacterDraft(id: string) {
  const db = await getDb()
  await db.delete('characters', id)
}

/** Soft-delete: hide from roster; keep row for claim/sync cleanup. */
export async function softDeleteCharacterDraft(id: string) {
  const db = await getDb()
  const draft = await db.get('characters', id)
  if (!draft) return
  await db.put(
    'characters',
    toPlain({
      ...draft,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dirty: false,
    }),
  )
}

/** Stable per-device id, generated once and cached in the meta store. */
export async function ensureLocalClientId(): Promise<string> {
  let id = await getMeta<string>('local_client_id')
  if (!id) {
    id = crypto.randomUUID()
    await setMeta('local_client_id', id)
  }
  return id
}

export async function saveGrants(grants: LocalGrant[]) {
  const db = await getDb()
  const tx = db.transaction('grants', 'readwrite')
  await Promise.all(grants.map((g) => tx.store.put(toPlain(g))))
  await tx.done
}

export async function getGrantsForCharacter(characterId: string) {
  const db = await getDb()
  return db.getAllFromIndex('grants', 'by-character', characterId)
}

export async function replaceGrantsForCharacter(characterId: string, grants: LocalGrant[]) {
  const db = await getDb()
  const existing = await db.getAllFromIndex('grants', 'by-character', characterId)
  const tx = db.transaction('grants', 'readwrite')
  await Promise.all(existing.map((g) => tx.store.delete(g.id)))
  await Promise.all(grants.map((g) => tx.store.put(toPlain(g))))
  await tx.done
}

export async function saveArcanaStateLocal(row: LocalArcanaState) {
  const db = await getDb()
  await db.put('arcanaState', toPlain(row))
}

export async function getArcanaStatesForCharacter(characterId: string) {
  const db = await getDb()
  return db.getAllFromIndex('arcanaState', 'by-character', characterId)
}

export async function replaceArcanaStatesForCharacter(
  characterId: string,
  rows: LocalArcanaState[],
) {
  const db = await getDb()
  const existing = await db.getAllFromIndex('arcanaState', 'by-character', characterId)
  const tx = db.transaction('arcanaState', 'readwrite')
  await Promise.all(existing.map((r) => tx.store.delete(r.id)))
  await Promise.all(rows.map((r) => tx.store.put(toPlain(r))))
  await tx.done
}
