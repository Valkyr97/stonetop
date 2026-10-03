/**
 * Improved Stat / Superior Stat picks made *during creation* (as one of
 * the playbook's free level-1 move choices). These raise a stat directly
 * rather than going through `engine/advancement.ts` (there's no level-up
 * or advancement-log entry yet at character creation) — see plan Phase 3.
 *
 * `sheet.setup.stat_bump_picks` holds one entry per taken slot of a
 * stat-bump move (e.g. `{ 'improved-stat': ['STR', null, 'DEX'] }` for a
 * move taken 3 times). `applyStatBumps` recomputes the *final* stats from
 * a stable base (the printed array assignment) plus these picks, so
 * toggling a pick on/off is always idempotent and cap-safe.
 *
 * The move's `statBumpCap` is a **maximum final value** (+2 for Improved
 * Stat, +3 for Superior Stat / Would-be Hero Superior), not a per-stat
 * take count.
 */
import type { MoveDef } from '../../content/types'
import { statBumpCap } from '../engine/moves'

export type StatBumpPicks = Record<string, (string | null)[]>

export function applyStatBumps(
  base: Record<string, number>,
  picks: StatBumpPicks,
  moves: MoveDef[],
): Record<string, number> {
  const result = { ...base }
  for (const [moveId, slots] of Object.entries(picks)) {
    const move = moves.find((m) => m.id === moveId)
    const cap = move ? statBumpCap(move) : null
    if (cap === null) continue
    for (const stat of slots) {
      if (!stat) continue
      const current = result[stat] ?? 0
      if (current >= cap) continue
      result[stat] = current + 1
    }
  }
  return result
}

/**
 * Whether this slot may still raise `stat` without exceeding the move's
 * max final value. Evaluates every other bump first (including other
 * slots of the same move), then checks `current < cap`.
 */
export function canRaiseStatWithBump(
  base: Record<string, number>,
  picks: StatBumpPicks,
  moves: MoveDef[],
  moveId: string,
  stat: string,
  cap: number,
  excludingSlot?: number,
): boolean {
  const withoutSlot: StatBumpPicks = {
    ...picks,
    [moveId]: (picks[moveId] ?? []).map((s, i) => (i === excludingSlot ? null : s)),
  }
  const current = applyStatBumps(base, withoutSlot, moves)[stat] ?? 0
  return current < cap
}

/** @deprecated Prefer `canRaiseStatWithBump` — kept name for call-site clarity. */
export function remainingBumpsForStat(
  base: Record<string, number>,
  picks: StatBumpPicks,
  moves: MoveDef[],
  moveId: string,
  stat: string,
  cap: number,
  excludingSlot?: number,
): number {
  return canRaiseStatWithBump(base, picks, moves, moveId, stat, cap, excludingSlot) ? 1 : 0
}
