/**
 * Which inserts belong on a character, and how they get attached.
 *
 * - "Class" inserts (inventory always; animal companion, crew, initiates
 *   of Danu, invocations when the playbook/background/move says so) are
 *   pack-driven via `creation_required_when` and auto-attach — no player or
 *   GM action needed.
 * - "Manual" inserts (`manual: true` in the pack: ghost, revenant,
 *   thrall) never auto-attach. They only become attachable once the GM
 *   hangs them via a `content_grants` row (`content_type: 'insert'`,
 *   `content_id: <insertId>`) — see `grant/visibility.ts`. The player then
 *   attaches (or removes) them from the play binder's "+" menu.
 * - Followers is also `manual` in the pack (not auto-attached at creation),
 *   but play mode always shows a Followers tab. Players add slots themselves.
 */
import type { CharacterState, InsertDef, Playbook } from '../../content/types'
import { heldMoveIds } from './moves'

/** Insert ids that should be attached automatically for this character. */
export function autoAttachedInsertIds(
  state: CharacterState,
  playbook: Playbook,
  inserts: InsertDef[],
): string[] {
  const ids = new Set<string>(['inventory'])
  const bg = playbook.backgrounds.find((b) => b.id === state.identity.background_id)
  for (const g of bg?.grants ?? []) if (g.type === 'insert') ids.add(g.id)
  for (const g of playbook.grants ?? []) if (g.type === 'insert') ids.add(g.id)

  const held = heldMoveIds(state, playbook)
  for (const insert of inserts) {
    if (insert.manual) continue
    const req = insert.creation_required_when
    if (!req) continue
    if (req.character_has_move && held.includes(req.character_has_move)) ids.add(insert.id)
    if (req.playbook && req.playbook === playbook.id) ids.add(insert.id)
    if (req.background && req.background === state.identity.background_id) ids.add(insert.id)
  }
  return [...ids]
}

export function isInsertAttached(state: CharacterState, insertId: string): boolean {
  return insertId in state.inserts
}

/** Attach every auto-attach-eligible insert that isn't already present,
 * seeding an empty state blob for each. Never touches manual inserts. */
export function attachAutoInserts(
  state: CharacterState,
  playbook: Playbook,
  inserts: InsertDef[],
): Record<string, unknown> {
  const next = { ...state.inserts }
  for (const id of autoAttachedInsertIds(state, playbook, inserts)) {
    if (!(id in next)) next[id] = {}
  }
  return next
}

export function attachInsert(state: CharacterState, insertId: string): Record<string, unknown> {
  if (insertId in state.inserts) return state.inserts
  return { ...state.inserts, [insertId]: {} }
}

export function detachInsert(state: CharacterState, insertId: string): Record<string, unknown> {
  if (!(insertId in state.inserts)) return state.inserts
  const next = { ...state.inserts }
  delete next[insertId]
  return next
}

/** True once the player has saved an animal companion (name or type). */
export function isAnimalCompanionCreated(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const typeId = typeof data.type_id === 'string' ? data.type_id.trim() : ''
  return Boolean(name || typeId)
}

export const FOLLOWER_SPECIAL_TAGS = ['exceptional', 'group'] as const
export const MAGNIFICENT_SPECIMEN_MOVE_ID = 'magnificent-specimen'
export const BEAST_OF_LEGEND_MOVE_ID = 'beast-of-legend'
/** Each Magnificent Specimen take grants two extra type-option picks. */
export const MAGNIFICENT_SPECIMEN_EXTRA_PICKS = 2

export const BEAST_OF_LEGEND_OPTIONS = [
  { id: 'exceptional', label: 'They are exceptional (roll +2 instead of +1)' },
  { id: 'hp-armor', label: 'They get +4 HP and +1 armor' },
  { id: 'unique-trait', label: 'They develop some unique ability or trait' },
] as const

export function splitFollowerTags(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function hasFollowerTag(tags: string, tag: string): boolean {
  const key = tag.trim().toLowerCase()
  return splitFollowerTags(tags).some((t) => t.toLowerCase() === key)
}

export function setFollowerTag(tags: string, tag: string, on: boolean): string {
  const key = tag.trim().toLowerCase()
  const parts = splitFollowerTags(tags)
  const without = parts.filter((t) => t.toLowerCase() !== key)
  if (!on) return without.join(', ')
  const existing = parts.find((t) => t.toLowerCase() === key)
  return [...without, existing ?? tag.trim()].join(', ')
}

export function followerSpecialTags(tags: string): string[] {
  return FOLLOWER_SPECIAL_TAGS.filter((t) => hasFollowerTag(tags, t))
}

export function followerOtherTags(tags: string): string {
  return splitFollowerTags(tags)
    .filter((t) => t.toLowerCase() !== 'exceptional' && t.toLowerCase() !== 'group')
    .join(', ')
}

export function withFollowerSpecialTags(otherTags: string, special: string[]): string {
  let next = splitFollowerTags(otherTags)
    .filter((t) => t.toLowerCase() !== 'exceptional' && t.toLowerCase() !== 'group')
    .join(', ')
  for (const tag of FOLLOWER_SPECIAL_TAGS) {
    next = setFollowerTag(next, tag, special.includes(tag))
  }
  return next
}

export function companionTraitPickMax(basePick: number, magnificentTakes: number): number {
  return Math.max(0, basePick) + MAGNIFICENT_SPECIMEN_EXTRA_PICKS * Math.max(0, magnificentTakes)
}
