// Syncs the local roster of characters. Unclaimed (local-only) characters are
// never sent anywhere. Claimed characters push/pull via the claim-secret RPCs
// in ../claim.ts — no Supabase session involved.
import { ensureContentPacks } from '../content/packLoader'
import {
  getArcanaStatesForCharacter,
  listCharacterDrafts,
  replaceArcanaStatesForCharacter,
  replaceGrantsForCharacter,
  saveCharacterDraft,
  type LocalArcanaState,
  type LocalGrant,
} from '../db/idb'
import {
  pullClaimedArcana,
  pullClaimedCharacter,
  pullClaimedGrants,
  pushClaimedArcanaState,
  pushClaimedCharacter,
} from '../claim'
import { migrateCharacterState } from '../sheet/engine'

export interface SyncReport {
  ok: boolean
  online: boolean
  contentVersion?: string
  charactersSynced: number
  charactersPulled: number
  grantsPulled: number
  errors: string[]
}

export async function syncAll(characterIds?: string[]): Promise<SyncReport> {
  const report: SyncReport = {
    ok: true,
    online: navigator.onLine,
    charactersSynced: 0,
    charactersPulled: 0,
    grantsPulled: 0,
    errors: [],
  }

  if (!navigator.onLine) {
    report.ok = false
    report.errors.push('Sin conexión: solo se usa caché local')
    return report
  }

  try {
    const manifest = await ensureContentPacks({ includeOptional: true })
    report.contentVersion = manifest.version
  } catch (e) {
    report.errors.push(`Contenido: ${(e as Error).message}`)
  }

  const drafts = (await listCharacterDrafts()).filter((d) => !d.deletedAt)
  const ids = characterIds ?? drafts.map((d) => d.id)

  for (const id of ids) {
    const draft = drafts.find((d) => d.id === id)
    if (!draft?.claim) continue // local-only character, nothing to sync yet

    const { characterId, claimSecret } = draft.claim
    try {
      if (draft.dirty) {
        await pushClaimedCharacter({
          characterId,
          claimSecret,
          state: draft.state,
          contentVersion: draft.contentVersion,
        })
        await saveCharacterDraft({ ...draft, dirty: false, updatedAt: new Date().toISOString() })
        report.charactersSynced += 1
      } else {
        const remote = await pullClaimedCharacter(characterId, claimSecret)
        // Opaque JSON blob — migrate any pre-v2 remote state on pull.
        const migrated = migrateCharacterState(remote.state ?? draft.state)
        await saveCharacterDraft({
          ...draft,
          state: migrated as unknown as Record<string, unknown>,
          contentVersion: remote.content_version,
          dirty: false,
          updatedAt: remote.updated_at,
        })
        report.charactersPulled += 1
      }

      const dirtyArcana = (await getArcanaStatesForCharacter(characterId)).filter((a) => a.dirty)
      for (const row of dirtyArcana) {
        await pushClaimedArcanaState({
          characterId,
          claimSecret,
          grantId: row.grant_id,
          unlocked: row.unlocked,
          progress: row.progress,
          consequences: row.consequences,
          state: row.state,
        })
      }

      const grants = await pullClaimedGrants(characterId, claimSecret)
      const localGrants: LocalGrant[] = grants.map((g) => ({
        id: g.id,
        character_id: g.character_id,
        content_type: g.content_type,
        content_id: g.content_id,
        visibility: g.visibility,
        granted_at: g.granted_at,
      }))
      await replaceGrantsForCharacter(characterId, localGrants)
      report.grantsPulled += localGrants.length

      const arcanaRows = await pullClaimedArcana(characterId, claimSecret)
      const localArcana: LocalArcanaState[] = arcanaRows.map((r) => ({
        id: r.id,
        grant_id: r.grant_id,
        character_id: r.character_id,
        unlocked: r.unlocked,
        progress: (r.progress ?? {}) as Record<string, unknown>,
        consequences: (r.consequences ?? []) as unknown[],
        state: (r.state ?? {}) as Record<string, unknown>,
        dirty: false,
        updatedAt: r.updated_at,
      }))
      await replaceArcanaStatesForCharacter(characterId, localArcana)
    } catch (e) {
      report.ok = false
      report.errors.push(`${id}: ${(e as Error).message}`)
    }
  }

  return report
}
