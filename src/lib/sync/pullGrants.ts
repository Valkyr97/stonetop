import { supabase } from '../supabase'
import {
  replaceArcanaStatesForCharacter,
  replaceGrantsForCharacter,
  type LocalArcanaState,
  type LocalGrant,
} from '../db/idb'

export async function pullGrantsForCharacter(characterId: string) {
  const { data: grants, error } = await supabase
    .from('content_grants')
    .select('*')
    .eq('character_id', characterId)

  if (error) throw error

  const localGrants: LocalGrant[] = (grants ?? []).map((g) => ({
    id: g.id,
    character_id: g.character_id,
    content_type: g.content_type,
    content_id: g.content_id,
    visibility: g.visibility,
    granted_at: g.granted_at,
  }))

  await replaceGrantsForCharacter(characterId, localGrants)

  const { data: arcanaRows, error: arcanaError } = await supabase
    .from('arcana_state')
    .select('*')
    .eq('character_id', characterId)

  if (arcanaError) throw arcanaError

  const localArcana: LocalArcanaState[] = (arcanaRows ?? []).map((r) => ({
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

  return { grants: localGrants, arcanaStates: localArcana }
}
