/**
 * Which inserts belong on a character, and how they get attached.
 *
 * - "Class" inserts (inventory always; animal companion, crew, initiates
 *   of Danu, invocations when the playbook/background/move says so) are
 *   pack-driven via `creation_required_when` and auto-attach — no player or
 *   GM action needed.
 * - "Manual" inserts (`manual: true` in the pack: followers, ghost,
 *   revenant, thrall) never auto-attach. They only become attachable once
 *   the GM hangs them via a `content_grants` row
 *   (`content_type: 'insert'`, `content_id: <insertId>`) — see
 *   `grant/visibility.ts`. The player then attaches (or removes) them from
 *   the play binder's "+" menu.
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
