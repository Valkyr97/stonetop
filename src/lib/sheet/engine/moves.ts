/**
 * Held-move bookkeeping shared by creation and play. Creation writes
 * `state.moves.selected` (fixed + background-granted + free level-1 picks,
 * via `startingMoveIds` in `sheet/sections.ts`); play adds to it indirectly
 * through `state.mechanics.advancement` (see `engine/advancement.ts`).
 * `heldMoveIds` is the single place that reconciles both into "what the
 * character currently has", honoring `replaces`.
 */
import type { CharacterState, MoveDef, Playbook } from '../../content/types'

export function moveById(playbook: Playbook, id: string): MoveDef | undefined {
  return playbook.moves.find((m) => m.id === id)
}

/** Where a character's starting moves come from (Splatbook-shaped). */
export interface StartingMovesPlan {
  fixed: string[]
  background: string[]
  pickOneGroups: string[][]
  chooseCount: number
  granted: string[]
}

export function startingMovesPlan(
  playbook: Playbook,
  backgroundId: string | null,
): StartingMovesPlan {
  const fixed = playbook.starting_move_rules.fixed ?? []
  const background =
    (playbook.backgrounds.find((b) => b.id === backgroundId)?.grants ?? [])
      .filter((g) => g.type === 'move')
      .map((g) => g.id)
  const pickOneGroups = (playbook.starting_move_rules.choice_groups ?? []).map(
    (g) => g.options,
  )
  return {
    fixed,
    background,
    pickOneGroups,
    chooseCount: playbook.starting_move_rules.free_choices ?? 0,
    granted: [...new Set([...fixed, ...background])],
  }
}

export function pickOneMembers(plan: StartingMovesPlan): Set<string> {
  return new Set(plan.pickOneGroups.flat())
}

export function freeChosenMoves(
  selected: string[],
  plan: StartingMovesPlan,
  /** Background `selection_effect` move ids — additional, not free picks. */
  extraGranted: Iterable<string> = [],
): string[] {
  const granted = new Set([...plan.granted, ...extraGranted])
  const pickOne = pickOneMembers(plan)
  return selected.filter((id) => !granted.has(id) && !pickOne.has(id))
}

export function prerequisitesMet(move: MoveDef, have: ReadonlySet<string>): boolean {
  return (move.requires ?? []).every((id) => have.has(id))
}

export function isStartable(move: MoveDef): boolean {
  return (move.min_level ?? 1) <= 1
}

/** Free-pick candidates at creation (excludes granted + pickOne members). */
export function choosableMoves(
  playbook: Playbook,
  backgroundId: string | null,
  extraGranted: Iterable<string> = [],
): MoveDef[] {
  const plan = startingMovesPlan(playbook, backgroundId)
  const granted = new Set([...plan.granted, ...extraGranted])
  const pickOne = pickOneMembers(plan)
  return playbook.moves.filter(
    (m) => !granted.has(m.id) && !pickOne.has(m.id) && isStartable(m),
  )
}

/**
 * Every move the character currently holds: creation picks plus every
 * level-up pick, minus any move that a later pick named as `replaced`.
 * Order is not meaningful; a repeatable move may appear more than once.
 */
export function heldMoveIds(state: CharacterState, playbook: Playbook): string[] {
  const advancementIds = state.mechanics.advancement.map((e) => e.moveId)
  const replaced = new Set(
    state.mechanics.advancement.map((e) => e.replaced).filter((x): x is string => !!x),
  )
  const all = [...state.moves.selected, ...advancementIds]
  // Only drop the *first* occurrence of a replaced id, so a repeatable move
  // that was also independently taken again elsewhere isn't over-pruned.
  const dropped = new Set<string>()
  const kept: string[] = []
  for (const id of all) {
    if (replaced.has(id) && !dropped.has(id)) {
      dropped.add(id)
      continue
    }
    kept.push(id)
  }
  return kept
}

export function isMoveHeld(state: CharacterState, playbook: Playbook, moveId: string): boolean {
  return heldMoveIds(state, playbook).includes(moveId)
}

export function heldCountForMove(state: CharacterState, playbook: Playbook, moveId: string): number {
  return heldMoveIds(state, playbook).filter((id) => id === moveId).length
}

/** Distinct held moves (one entry per id) for sheet display — retakes share a card. */
export function uniqueHeldMoves(state: CharacterState, playbook: Playbook): MoveDef[] {
  const seen = new Set<string>()
  const out: MoveDef[] = []
  for (const id of heldMoveIds(state, playbook)) {
    if (seen.has(id)) continue
    seen.add(id)
    const move = moveById(playbook, id)
    if (move) out.push(move)
  }
  return out
}

/**
 * Stat-bump max final value for a move, if it is one ("Improved Stat" → +2,
 * "Superior Stat" → +3 — including the Would-be Hero's Superior Stat after
 * Potential for Greatness). Detected by id rather than a dedicated pack
 * field since the ids are stable across all playbooks; falls back to
 * parsing the `creation_fields` constraint text ("...to a max of +N") for
 * any future move shaped the same way.
 */
export function statBumpCap(move: MoveDef): number | null {
  if (move.id === 'improved-stat') return 2
  if (move.id === 'superior-stat') return 3
  const field = move.creation_fields?.find((f) => f.key === 'stat')
  const constraint = String((field as { constraint?: unknown } | undefined)?.constraint ?? '')
  const match = constraint.match(/max of \+?(\d+)/i)
  return match ? Number(match[1]) : null
}

export function isStatBumpMove(move: MoveDef): boolean {
  return statBumpCap(move) !== null
}
