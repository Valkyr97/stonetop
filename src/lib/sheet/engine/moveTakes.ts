/**
 * Take-count helpers for the shared Moves catalog: held counts, gate checks,
 * grant sources, and mark/unmark for creation + edit (level-up stays in
 * `advancement.applyLevelUp`).
 */
import type { CharacterState, MoveDef, Playbook } from '../../content/types'
import { moveRepeatCap, startingMoveIds } from '../sections'
import { applyLevelUp } from './advancement'
import {
  freeChosenMoves,
  heldMoveIds,
  isStatBumpMove,
  moveById,
  startingMovesPlan,
} from './moves'
import type { StatKey } from './stats'
import { isTrackerFull, syncTrackers } from './trackers'
import { syncWellVersedTopics, WELL_VERSED_MOVE_ID } from './wellVersed'

export function heldCounts(state: CharacterState, playbook: Playbook): Map<string, number> {
  const counts = new Map<string, number>()
  for (const id of heldMoveIds(state, playbook)) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

export function effectGrantIds(state: CharacterState): string[] {
  return (
    (state.setup.background_effect_grants as { moves?: string[] } | undefined)?.moves ?? []
  ).map(String)
}

/**
 * Minimum takes that must remain (fixed + background + effect grants).
 * Usually 0 or 1 per id.
 */
export function protectedTakeCount(
  playbook: Playbook,
  state: CharacterState,
  moveId: string,
): number {
  const plan = startingMovesPlan(playbook, state.identity.background_id)
  let n = 0
  if (plan.fixed.includes(moveId)) n += 1
  if (plan.background.includes(moveId)) n += 1
  if (effectGrantIds(state).includes(moveId)) n += 1
  return n
}

/** Badge labels for auto-granted takes (first matching source wins). */
export function grantSourceMap(playbook: Playbook, state: CharacterState): Map<string, string> {
  const map = new Map<string, string>()
  const plan = startingMovesPlan(playbook, state.identity.background_id)
  for (const id of plan.fixed) map.set(id, 'Starting')
  const bg = playbook.backgrounds.find((b) => b.id === state.identity.background_id)
  const bgLabel = bg?.name ?? 'Background'
  for (const id of plan.background) map.set(id, bgLabel)
  for (const id of effectGrantIds(state)) {
    if (!map.has(id)) map.set(id, bgLabel)
  }
  return map
}

export interface GateInfo {
  gated: boolean
  reasons: string[]
}

/**
 * Whether the character meets level + require gates. Pass `effectiveLevel`
 * = sheet.level + 1 when previewing a level-up pick.
 */
export function moveGateInfo(
  state: CharacterState,
  playbook: Playbook,
  move: MoveDef,
  effectiveLevel = state.mechanics.level,
): GateInfo {
  const reasons: string[] = []
  const min = move.min_level ?? 1
  if (effectiveLevel < min) {
    reasons.push(`Requires level ${min}+ (you are level ${effectiveLevel})`)
  }
  const held = new Set(heldMoveIds(state, playbook))
  for (const r of move.requires ?? []) {
    if (/\sOR\s/i.test(r) || /^[A-Z]{3}\s*[><=]/.test(r) || />=/.test(r)) continue
    if (r.endsWith(':full')) {
      const id = r.slice(0, -':full'.length)
      if (!held.has(id)) reasons.push(`Requires ${moveById(playbook, id)?.name ?? id}`)
      else if (!isTrackerFull(state, id)) {
        reasons.push(`Requires ${moveById(playbook, id)?.name ?? id} tracker full`)
      }
      continue
    }
    if (r.includes(':')) {
      const id = r.split(':')[0]!
      if (!held.has(id)) reasons.push(`Requires ${moveById(playbook, id)?.name ?? id}`)
      continue
    }
    if (!held.has(r)) reasons.push(`Requires ${moveById(playbook, r)?.name ?? r}`)
  }
  return { gated: reasons.length > 0, reasons }
}

export type TakeMutation =
  | { ok: true; state: CharacterState }
  | { ok: false; error: string }

function cloneState(state: CharacterState): CharacterState {
  return JSON.parse(JSON.stringify(state)) as CharacterState
}

function resizeStatBumpSlots(
  draft: CharacterState,
  playbook: Playbook,
  moveId: string,
  newCount: number,
): void {
  const move = moveById(playbook, moveId)
  if (!move || !isStatBumpMove(move)) return
  const picks = {
    ...((draft.setup.stat_bump_picks as Record<string, (string | null)[]> | undefined) ?? {}),
  }
  const slots = picks[moveId] ?? []
  picks[moveId] = Array.from({ length: newCount }, (_, i) => slots[i] ?? null)
  draft.setup.stat_bump_picks = picks
}

/**
 * Creation: set absolute take count for a move (free budget, pick-one, grants).
 */
export function setCreationTakes(
  state: CharacterState,
  playbook: Playbook,
  moveId: string,
  nextCount: number,
): TakeMutation {
  const move = moveById(playbook, moveId)
  if (!move) return { ok: false, error: 'Unknown move.' }
  const plan = startingMovesPlan(playbook, state.identity.background_id)
  const effects = effectGrantIds(state)
  const pickOne = new Set(plan.pickOneGroups.flat())
  const protectedIds = new Set([...plan.granted, ...effects])
  const floor = protectedTakeCount(playbook, state, moveId)

  if (nextCount < floor) {
    return { ok: false, error: 'That move is granted and cannot be unmarked.' }
  }

  const cap = moveRepeatCap(move)
  const count = Math.max(floor, Math.min(cap, Math.floor(nextCount)))
  const draft = cloneState(state)

  if (pickOne.has(moveId)) {
    const group = plan.pickOneGroups.find((g) => g.includes(moveId)) ?? [moveId]
    const without = draft.moves.selected.filter((id) => !group.includes(id))
    draft.moves.selected = startingMoveIds(playbook, draft.identity.background_id, [
      ...without,
      ...(count > 0 ? [moveId] : []),
    ])
    return { ok: true, state: draft }
  }

  if (protectedIds.has(moveId) && count === floor) {
    // Only grant takes — nothing to change.
    return { ok: true, state: draft }
  }

  const others = draft.moves.selected.filter((id) => id !== moveId)
  // Keep grant copies, then player extras up to `count - floor`… simpler: rebuild
  // via startingMoveIds with desired multiplicity of moveId among extras.
  const grantCopies = Array.from({ length: floor }, () => moveId)
  const extraCopies = Array.from({ length: Math.max(0, count - floor) }, () => moveId)
  let next = startingMoveIds(playbook, draft.identity.background_id, [
    ...others.filter((id) => !protectedIds.has(id) || id !== moveId),
    ...grantCopies,
    ...extraCopies,
  ])
  // startingMoveIds already injects fixed+background; strip accidental dupes of protected
  // by relying on its extras filter. Ensure free budget (by take count, not unique ids —
  // Improved Stat can otherwise burn two free picks via repeat boxes).
  const free = freeChosenMoves(next, plan, effects)
  if (free.length > plan.chooseCount) {
    const trimmedFree = free.slice(0, plan.chooseCount)
    const pickOnes = plan.pickOneGroups.flatMap((g) => g.filter((id) => next.includes(id)))
    next = startingMoveIds(playbook, draft.identity.background_id, [
      ...pickOnes,
      ...effects,
      ...trimmedFree,
    ])
  }
  draft.moves.selected = next
  resizeStatBumpSlots(
    draft,
    playbook,
    moveId,
    draft.moves.selected.filter((id) => id === moveId).length,
  )
  return { ok: true, state: draft }
}

/**
 * Edit (post-creation): add one take. Prefers advancement log (no XP spend).
 */
export function markTakeEdit(
  state: CharacterState,
  playbook: Playbook,
  moveId: string,
  stat?: StatKey,
): TakeMutation {
  const move = moveById(playbook, moveId)
  if (!move) return { ok: false, error: 'Unknown move.' }
  const counts = heldCounts(state, playbook)
  const taken = counts.get(moveId) ?? 0
  const cap = moveRepeatCap(move)
  if (taken >= cap) return { ok: false, error: 'No empty take boxes left on this move.' }
  if (isStatBumpMove(move) && !stat) {
    return { ok: false, error: 'Choose which stat to raise.' }
  }

  const draft = cloneState(state)
  if (isStatBumpMove(move) && stat) {
    const bumpCap = move.id === 'improved-stat' ? 2 : 3
    const current = draft.mechanics.stats[stat] ?? 0
    if (current >= bumpCap) {
      return { ok: false, error: `${stat} is already at the cap for this move.` }
    }
    draft.mechanics.stats[stat] = current + 1
  }
  draft.mechanics.advancement = [
    ...draft.mechanics.advancement,
    {
      level: draft.mechanics.level,
      moveId,
      stat,
      replaced: move.replaces ?? null,
    },
  ]
  draft.mechanics.trackers = syncTrackers(draft, playbook)
  if (moveId === WELL_VERSED_MOVE_ID) syncWellVersedTopics(draft, playbook)
  return { ok: true, state: draft }
}

/**
 * Edit: remove one take. Drops newest matching advancement entry first, then
 * a non-protected selected occurrence.
 */
export function unmarkTakeEdit(
  state: CharacterState,
  playbook: Playbook,
  moveId: string,
): TakeMutation {
  const counts = heldCounts(state, playbook)
  const taken = counts.get(moveId) ?? 0
  const floor = protectedTakeCount(playbook, state, moveId)
  if (taken <= floor) {
    return { ok: false, error: 'That take is granted and cannot be unmarked.' }
  }

  const draft = cloneState(state)
  const advIdx = [...draft.mechanics.advancement]
    .map((e, i) => ({ e, i }))
    .reverse()
    .find((x) => x.e.moveId === moveId)?.i

  if (advIdx != null) {
    const entry = draft.mechanics.advancement[advIdx]!
    if (entry.stat) {
      const s = entry.stat as StatKey
      draft.mechanics.stats[s] = Math.max(-1, (draft.mechanics.stats[s] ?? 0) - 1)
    }
    draft.mechanics.advancement = draft.mechanics.advancement.filter((_, i) => i !== advIdx)
  } else {
    const plan = startingMovesPlan(playbook, draft.identity.background_id)
    const effects = effectGrantIds(draft)
    const protectedIds = new Set([...plan.granted, ...effects])
    let removed = false
    const nextSel: string[] = []
    for (let i = draft.moves.selected.length - 1; i >= 0; i--) {
      const id = draft.moves.selected[i]!
      if (!removed && id === moveId && !protectedIds.has(id)) {
        removed = true
        continue
      }
      nextSel.push(id)
    }
    if (!removed) {
      // Last resort: remove one selected copy even if listed as grant multiplicity
      for (let i = draft.moves.selected.length - 1; i >= 0; i--) {
        if (draft.moves.selected[i] === moveId) {
          draft.moves.selected = [
            ...draft.moves.selected.slice(0, i),
            ...draft.moves.selected.slice(i + 1),
          ]
          removed = true
          break
        }
      }
    } else {
      draft.moves.selected = nextSel.reverse()
    }
    if (!removed) return { ok: false, error: 'Could not find a take to remove.' }
    resizeStatBumpSlots(
      draft,
      playbook,
      moveId,
      draft.moves.selected.filter((id) => id === moveId).length,
    )
  }

  draft.mechanics.trackers = syncTrackers(draft, playbook)
  if (moveId === WELL_VERSED_MOVE_ID) syncWellVersedTopics(draft, playbook)
  return { ok: true, state: draft }
}

/** Level-up: spend XP and add one take (wrapper for catalog). */
export function markTakeLevelUp(
  state: CharacterState,
  playbook: Playbook,
  moveId: string,
  stat?: StatKey,
): TakeMutation {
  const move = moveById(playbook, moveId)
  if (!move) return { ok: false, error: 'Unknown move.' }
  const taken = heldCounts(state, playbook).get(moveId) ?? 0
  if (taken >= moveRepeatCap(move)) {
    return { ok: false, error: 'No empty take boxes left on this move.' }
  }
  const result = applyLevelUp(state, playbook, { moveId, stat })
  if (!result.ok) return result
  if (moveId === WELL_VERSED_MOVE_ID) syncWellVersedTopics(result.state, playbook)
  return result
}

export function confirmGatedMark(moveName: string, reasons: string[]): boolean {
  const detail = reasons.length ? `\n\n${reasons.join('\n')}` : ''
  return confirm(
    `You don’t meet the requirements for ${moveName} yet.${detail}\n\nMark anyway?`,
  )
}

export function confirmUnmarkTake(moveName: string): boolean {
  return confirm(`Remove a take of ${moveName}?`)
}
