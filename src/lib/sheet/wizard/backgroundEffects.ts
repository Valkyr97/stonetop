/**
 * Apply background `selection_effect` grants (e.g. Fox "A Life of Crime"
 * extra move + possession) from `setup.background_fields` into moves /
 * possessions. Tracks previously applied ids so switching backgrounds or
 * changing a pick swaps cleanly.
 */
import type { Background, CharacterState, Playbook } from '../../content/types'
import { startingMoveIds } from '../sections'
import { syncWellVersedTopics } from '../engine/wellVersed'

const EFFECT_KEY = 'background_effect_grants'

interface EffectGrants {
  moves: string[]
  possessions: string[]
}

function readEffects(setup: Record<string, unknown>): EffectGrants {
  const raw = setup[EFFECT_KEY] as EffectGrants | undefined
  return {
    moves: Array.isArray(raw?.moves) ? raw.moves.map(String) : [],
    possessions: Array.isArray(raw?.possessions) ? raw.possessions.map(String) : [],
  }
}

function resolveEffectIds(
  playbook: Playbook,
  bg: Background,
  fields: Record<string, unknown>,
): EffectGrants {
  const moves: string[] = []
  const possessions: string[] = []
  const moveIds = new Set(playbook.moves.map((m) => m.id))

  for (const g of bg.grants ?? []) {
    if (g.type !== 'selection_effect') continue
    const from = (g as { from?: string }).from
    if (!from) continue
    const val = fields[from]
    const picks = Array.isArray(val) ? val.map(String) : typeof val === 'string' && val ? [val] : []
    for (const id of picks) {
      if (moveIds.has(id)) moves.push(id)
      else possessions.push(id)
    }
  }
  return { moves: [...new Set(moves)], possessions: [...new Set(possessions)] }
}

/** Mutates `draft` in place: refresh selection_effect grants for the chosen background. */
export function applyBackgroundSelectionEffects(
  draft: CharacterState,
  playbook: Playbook,
): void {
  const bg = playbook.backgrounds.find((b) => b.id === draft.identity.background_id)
  const prev = readEffects(draft.setup)
  const fields = (draft.setup.background_fields as Record<string, unknown> | undefined) ?? {}
  const next = bg ? resolveEffectIds(playbook, bg, fields) : { moves: [], possessions: [] }

  // Moves: drop previous effect grants, keep player picks + fixed/bg grants, add new effects.
  const withoutPrev = draft.moves.selected.filter((id) => !prev.moves.includes(id))
  const withEffects = [...withoutPrev, ...next.moves]
  draft.moves.selected = startingMoveIds(playbook, draft.identity.background_id, withEffects)

  // Possessions: same swap pattern.
  const possWithout = draft.possessions.selected.filter((id) => !prev.possessions.includes(id))
  for (const id of next.possessions) {
    if (!possWithout.includes(id)) possWithout.push(id)
  }
  draft.possessions.selected = possWithout

  draft.setup[EFFECT_KEY] = next
  syncWellVersedTopics(draft, playbook)
}

/** Human label for a creation_field option id (move / possession / title-case). */
export function backgroundOptionLabel(
  playbook: Playbook,
  optionId: string,
): string {
  const move = playbook.moves.find((m) => m.id === optionId)
  if (move) return move.name
  const poss = (
    (playbook.special_possessions as { options?: { id: string; name: string }[] } | undefined)
      ?.options ?? []
  ).find((o) => o.id === optionId)
  if (poss) return poss.name
  return optionId
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
