/**
 * Level-up: XP cost curve and applying a pick. Sheet-emulator style — the
 * player may choose any move on the playbook; prerequisites are not enforced
 * (paper sheet / house rules). Pure functions over CharacterState.
 */
import type { CharacterState, MoveDef, Playbook } from '../../content/types'
import { moveRepeatCap } from '../sections'
import { heldMoveIds, moveById, statBumpCap } from './moves'
import type { StatKey } from './stats'
import { syncTrackers } from './trackers'

/** XP cost to advance from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return 6 + 2 * level
}

export function canLevelUp(state: CharacterState): boolean {
  return state.mechanics.xp >= xpForNextLevel(state.mechanics.level)
}

export interface LevelUpOption {
  move: MoveDef
  /** How many more times this move may still be taken (>= 1), informational. */
  remainingTakes: number
  /** Already held at least once. */
  alreadyHeld: boolean
}

/**
 * Moves offered in the level-up picker. Emulator mode: every playbook move,
 * including ones the book would gate — player decides.
 */
export function legalLevelUpMoves(state: CharacterState, playbook: Playbook): LevelUpOption[] {
  const held = heldMoveIds(state, playbook)
  const heldCounts = new Map<string, number>()
  for (const id of held) heldCounts.set(id, (heldCounts.get(id) ?? 0) + 1)

  const options: LevelUpOption[] = []
  for (const move of playbook.moves) {
    const cap = moveRepeatCap(move)
    const taken = heldCounts.get(move.id) ?? 0
    options.push({
      move,
      remainingTakes: Math.max(1, cap - taken),
      alreadyHeld: taken > 0,
    })
  }
  return options
}

export interface LevelUpChoice {
  moveId: string
  /** Required when the chosen move is a stat-bump move (Improved/Superior Stat). */
  stat?: StatKey
}

export type LevelUpResult = { ok: true; state: CharacterState } | { ok: false; error: string }

/** Spend the XP cost, add the level, record the pick, and re-sync trackers. */
export function applyLevelUp(
  state: CharacterState,
  playbook: Playbook,
  choice: LevelUpChoice,
): LevelUpResult {
  if (!canLevelUp(state)) return { ok: false, error: 'Not enough XP yet.' }

  const move = moveById(playbook, choice.moveId)
  if (!move) return { ok: false, error: 'Unknown move.' }

  const cap = statBumpCap(move)
  if (cap !== null) {
    if (!choice.stat) return { ok: false, error: 'Choose which stat to raise.' }
    const current = state.mechanics.stats[choice.stat] ?? 0
    if (current >= cap) return { ok: false, error: `${choice.stat} is already at the cap for this move.` }
  }

  const next: CharacterState = JSON.parse(JSON.stringify(state))
  const cost = xpForNextLevel(next.mechanics.level)
  next.mechanics.xp -= cost
  next.mechanics.level += 1
  if (cap !== null && choice.stat) {
    next.mechanics.stats[choice.stat] = (next.mechanics.stats[choice.stat] ?? 0) + 1
  }
  next.mechanics.advancement = [
    ...next.mechanics.advancement,
    { level: next.mechanics.level, moveId: move.id, stat: choice.stat, replaced: move.replaces ?? null },
  ]
  // Level-up picks live only in `advancement`. `heldMoveIds` merges them with
  // creation `moves.selected` — writing here too double-lists the move.
  next.mechanics.trackers = syncTrackers(next, playbook)

  return { ok: true, state: next }
}

export interface AdvancementLogEntry {
  level: number
  moveName: string
  stat?: string
  replacedName?: string
}

export function advancementLog(state: CharacterState, playbook: Playbook): AdvancementLogEntry[] {
  return state.mechanics.advancement.map((entry) => ({
    level: entry.level,
    moveName: moveById(playbook, entry.moveId)?.name ?? entry.moveId,
    stat: entry.stat,
    replacedName: entry.replaced ? moveById(playbook, entry.replaced)?.name ?? entry.replaced : undefined,
  }))
}
