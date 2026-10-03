// Player devices never authenticate with Supabase. Linking a locally created
// character to a GM's campaign goes through a "claim": the server hands back
// an opaque secret (stored only in this device's IndexedDB) that acts as the
// credential for all further push/pull calls for that character.
import { supabase } from './supabase'
import type { ArcanaStateRow, Character, ContentGrant } from './database.types'

export interface ClaimResult {
  character_id: string
  campaign_id: string
  campaign_name: string
  claim_secret: string
}

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data ?? null
}

export async function claimCharacter(opts: {
  joinCode: string
  playbookId: string
  state: unknown
  contentVersion?: string | null
  localClientId?: string | null
}): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('claim_character', {
    p_join_code: opts.joinCode.trim().toUpperCase(),
    p_playbook_id: opts.playbookId,
    p_state: opts.state as never,
    p_content_version: opts.contentVersion ?? null,
    p_local_client_id: opts.localClientId ?? null,
  })
  if (error) throw error
  const row = firstRow(data as ClaimResult | ClaimResult[] | null)
  if (!row) throw new Error('No se pudo unir a la mesa')
  return row
}

export async function pushClaimedCharacter(opts: {
  characterId: string
  claimSecret: string
  state: unknown
  contentVersion?: string | null
}) {
  const { error } = await supabase.rpc('push_character_state', {
    p_character_id: opts.characterId,
    p_claim_secret: opts.claimSecret,
    p_state: opts.state as never,
    p_content_version: opts.contentVersion ?? null,
  })
  if (error) throw error
}

export async function pullClaimedCharacter(characterId: string, claimSecret: string) {
  const { data, error } = await supabase.rpc('pull_character_state', {
    p_character_id: characterId,
    p_claim_secret: claimSecret,
  })
  if (error) throw error
  const row = firstRow(data as Character | Character[] | null)
  if (!row) throw new Error('Personaje no encontrado')
  return row
}

export async function pullClaimedGrants(characterId: string, claimSecret: string) {
  const { data, error } = await supabase.rpc('pull_character_grants', {
    p_character_id: characterId,
    p_claim_secret: claimSecret,
  })
  if (error) throw error
  return (data ?? []) as ContentGrant[]
}

export async function pullClaimedArcana(characterId: string, claimSecret: string) {
  const { data, error } = await supabase.rpc('pull_character_arcana', {
    p_character_id: characterId,
    p_claim_secret: claimSecret,
  })
  if (error) throw error
  return (data ?? []) as ArcanaStateRow[]
}

export async function pushClaimedArcanaState(opts: {
  characterId: string
  claimSecret: string
  grantId: string
  unlocked: boolean
  progress: unknown
  consequences: unknown
  state: unknown
}) {
  const { error } = await supabase.rpc('push_arcana_state', {
    p_character_id: opts.characterId,
    p_claim_secret: opts.claimSecret,
    p_grant_id: opts.grantId,
    p_unlocked: opts.unlocked,
    p_progress: opts.progress as never,
    p_consequences: opts.consequences as never,
    p_state: opts.state as never,
  })
  if (error) throw error
}

/** Soft-delete a claimed character on the server (sets deleted_at). */
export async function softDeleteClaimedCharacter(characterId: string, claimSecret: string) {
  const { error } = await supabase.rpc('soft_delete_claimed_character', {
    p_character_id: characterId,
    p_claim_secret: claimSecret,
  })
  if (error) throw error
}
