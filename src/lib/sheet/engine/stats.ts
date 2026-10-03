/**
 * Stonetop's six stats and the book's three debilities. Pure data/lookups —
 * no UI, no storage.
 *
 * Also: playbook stat-array assignment helpers (Splatbook-style). A playbook
 * prints a fixed array of six numbers; the player distributes them across the
 * six stats, each value used once.
 */
import type { DebilitiesState } from '../../content/types'

export const STAT_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
export type StatKey = (typeof STAT_KEYS)[number]

export const DEBILITY_KEYS = ['weakened', 'dazed', 'miserable'] as const
export type DebilityKey = (typeof DEBILITY_KEYS)[number]

/** Which stat pair each debility drags down (Harm & Healing rules). */
export const DEBILITY_STATS: Record<DebilityKey, readonly StatKey[]> = {
  weakened: ['STR', 'DEX'],
  dazed: ['INT', 'WIS'],
  miserable: ['CON', 'CHA'],
}

export const DEBILITY_LABELS: Record<DebilityKey, string> = {
  weakened: 'Weakened',
  dazed: 'Dazed',
  miserable: 'Miserable',
}

export function debilityForStat(stat: StatKey): DebilityKey {
  return DEBILITY_KEYS.find((key) => DEBILITY_STATS[key].includes(stat))!
}

export function isStatDebilitated(debilities: DebilitiesState, stat: StatKey): boolean {
  return !!debilities[debilityForStat(stat)]
}

export function emptyDebilities(): DebilitiesState {
  return { weakened: false, dazed: false, miserable: false }
}

/** Partial base assignment during creation — missing keys are unassigned. */
export type StatAssignments = Partial<Record<StatKey, number>>

export function formatStatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

export function assignedStatValues(assignments: StatAssignments): number[] {
  return STAT_KEYS.flatMap((key) => (key in assignments ? [assignments[key]!] : []))
}

/**
 * Array values not yet spent (multiset difference). `except` keeps that
 * stat's current value selectable while excluding everyone else's.
 */
export function remainingStatValues(
  array: number[],
  assignments: StatAssignments,
  except?: StatKey,
): number[] {
  const pool = [...array]
  for (const key of STAT_KEYS) {
    if (key === except) continue
    if (!(key in assignments)) continue
    const i = pool.indexOf(assignments[key]!)
    if (i !== -1) pool.splice(i, 1)
  }
  return pool
}

/** All six stats assigned, and values are exactly a permutation of the array. */
export function isStatArrayComplete(array: number[], assignments: StatAssignments): boolean {
  const assigned = assignedStatValues(assignments)
  if (assigned.length !== array.length) return false
  const pool = [...array]
  for (const v of assigned) {
    const i = pool.indexOf(v)
    if (i === -1) return false
    pool.splice(i, 1)
  }
  return pool.length === 0
}
