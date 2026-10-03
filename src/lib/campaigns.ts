import { supabase } from './supabase'
import type { CreationPack, Playbook } from './content/types'

function randomJoinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export async function createCampaign(name: string) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('No autenticado')

  const join_code = randomJoinCode()
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({ name, join_code, gm_id: auth.user.id })
    .select('*')
    .single()
  if (error) throw error

  const { error: memberError } = await supabase.from('campaign_members').insert({
    campaign_id: campaign.id,
    user_id: auth.user.id,
    role: 'gm',
  })
  if (memberError) throw memberError

  return campaign
}

export async function listMyCampaigns() {
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listCampaignCharacters(campaignId: string) {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export function playbooksFromPack(pack: CreationPack): Playbook[] {
  return pack.content.playbooks
}

export async function grantContent(opts: {
  characterId: string
  contentType: 'insert' | 'arcana_minor' | 'arcana_major'
  contentId: string
  visibility: 'front_only' | 'full'
}) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('No autenticado')

  const { data: grant, error } = await supabase
    .from('content_grants')
    .upsert(
      {
        character_id: opts.characterId,
        granted_by: auth.user.id,
        content_type: opts.contentType,
        content_id: opts.contentId,
        visibility: opts.visibility,
      },
      { onConflict: 'character_id,content_type,content_id' },
    )
    .select('*')
    .single()
  if (error) throw error

  if (opts.contentType === 'arcana_minor' || opts.contentType === 'arcana_major') {
    await supabase.from('arcana_state').upsert(
      {
        grant_id: grant.id,
        character_id: opts.characterId,
        unlocked: opts.visibility === 'full',
      },
      { onConflict: 'grant_id' },
    )
  }

  return grant
}

export async function updateGrantVisibility(grantId: string, visibility: 'front_only' | 'full') {
  const { data, error } = await supabase
    .from('content_grants')
    .update({ visibility })
    .eq('id', grantId)
    .select('*')
    .single()
  if (error) throw error

  if (data.content_type.startsWith('arcana')) {
    await supabase
      .from('arcana_state')
      .update({ unlocked: visibility === 'full' })
      .eq('grant_id', grantId)
  }
  return data
}
