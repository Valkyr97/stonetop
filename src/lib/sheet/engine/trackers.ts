/**
 * Use-box trackers for held moves that print play marks (Anger Is a Gift's
 * Resolve, Potential for Greatness, Logbook uses, etc). Take-again / stat-bump
 * moves (Improved Stat, Big Magic) are *not* play trackers — their "boxes"
 * are take counts handled at creation and level-up.
 *
 * Synced after creation and after every level-up so the set stays current
 * without discarding marks the player already made.
 *
 * Player-created `customTrackers` (Readiness, etc.) live separately and are
 * never wiped by sync.
 */
import type { CharacterState, MoveDef, Playbook, TrackerState } from '../../content/types'
import { movePrintedBoxes, moveRepeatCap } from '../sections'
import { heldMoveIds, isStatBumpMove, moveById } from './moves'

/**
 * The pack doesn't carry a `boxes` field for every tracked move — Potential
 * for Greatness prints 6 marks (one per bonus) in the book, but its pack
 * entry has no `boxes`/`repeatable` shape (it isn't a "take again" move).
 * Special-cased here since it's the one move the advancement engine also
 * gates on (`superior-stat` requires all 6 marks).
 */
const BOX_OVERRIDES: Record<string, number> = {
  'potential-for-greatness': 6,
}

export function printedBoxesForMove(move: MoveDef): number {
  if (BOX_OVERRIDES[move.id] != null) return BOX_OVERRIDES[move.id]!
  if (move.tracker?.boxes != null && move.tracker.boxes > 0) return Math.floor(move.tracker.boxes)
  return movePrintedBoxes(move)
}

/** True when `boxes` means take-again / level-up repeats, not spendable play uses. */
export function isTakeAgainMove(move: MoveDef): boolean {
  if (isStatBumpMove(move)) return true
  return moveRepeatCap(move) > 1
}

/** True when this move should expose play-mode mark boxes (not take-counts). */
export function isPlayTrackerMove(move: MoveDef): boolean {
  if (isTakeAgainMove(move)) return false
  if (move.tracker?.boxes != null) return move.tracker.boxes >= 1
  return printedBoxesForMove(move) > 1
}

/** Box count for play-use tracks; 0 when the move has no play tracker. */
export function playTrackerBoxes(move: MoveDef): number {
  return isPlayTrackerMove(move) ? printedBoxesForMove(move) : 0
}

/**
 * Parse a pack tracker label into a book-style header track.
 *
 * - `ammo: a few left / out` → per-mark labels (no group title; book prints
 *   ○ a few left ○ out on the title row)
 * - `Nerve` / `Blessing` → group title beside bare circles
 * - `uses` / empty → bare circles only
 */
export function parseTrackerLabel(label: string | null | undefined): {
  title: string | null
  markLabels: string[]
} {
  const t = String(label ?? '').trim()
  if (!t || /^uses?$/i.test(t)) return { title: null, markLabels: [] }
  const colon = t.indexOf(':')
  if (colon > 0) {
    const head = t.slice(0, colon).trim()
    const tail = t.slice(colon + 1).trim()
    const markLabels = tail
      ? tail.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean)
      : []
    if (markLabels.length > 0) return { title: null, markLabels }
    if (head && !/^uses?$/i.test(head)) return { title: head, markLabels: [] }
  }
  return { title: t, markLabels: [] }
}

/**
 * Short title for a play track when there are no per-mark labels.
 * Omits generic "uses". Prefer `parseTrackerLabel` for UI.
 */
export function trackerDisplayTitle(label: string | null | undefined): string | null {
  return parseTrackerLabel(label).title
}

/** Recompute the tracker set from currently-held moves, preserving marks. */
export function syncTrackers(
  state: CharacterState,
  playbook: Playbook,
): Record<string, TrackerState> {
  const next: Record<string, TrackerState> = {}
  const seen = new Set<string>()
  for (const id of heldMoveIds(state, playbook)) {
    if (seen.has(id)) continue
    seen.add(id)
    const move = moveById(playbook, id)
    if (!move || !isPlayTrackerMove(move)) continue
    const boxes = printedBoxesForMove(move)
    const existing = state.mechanics.trackers[id]
    next[id] = {
      label: move.name,
      boxes,
      marked: Math.min(existing?.marked ?? 0, boxes),
    }
  }
  return next
}

export function setTrackerMarks(
  state: CharacterState,
  moveId: string,
  marked: number,
): Record<string, TrackerState> {
  const tracker = state.mechanics.trackers[moveId]
  if (!tracker) return state.mechanics.trackers
  const clamped = Math.max(0, Math.min(marked, tracker.boxes))
  return { ...state.mechanics.trackers, [moveId]: { ...tracker, marked: clamped } }
}

export function isTrackerFull(state: CharacterState, moveId: string): boolean {
  const tracker = state.mechanics.trackers[moveId]
  return !!tracker && tracker.marked >= tracker.boxes
}

function clampMarked(marked: number, boxes: number): number {
  return Math.max(0, Math.min(marked, boxes))
}

export function readCustomTrackers(state: CharacterState): TrackerState[] {
  return Array.isArray(state.mechanics.customTrackers)
    ? state.mechanics.customTrackers.map((t) => ({
        label: String(t.label ?? 'Token'),
        boxes: Math.max(1, Number(t.boxes) || 1),
        marked: clampMarked(Number(t.marked) || 0, Math.max(1, Number(t.boxes) || 1)),
      }))
    : []
}

/** Custom trackers store label as identity; we key by index in the array. */
export function addCustomTracker(
  state: CharacterState,
  label: string,
  boxes = 3,
): TrackerState[] {
  const list = readCustomTrackers(state)
  const n = Math.max(1, Math.min(12, Math.floor(boxes) || 3))
  return [
    ...list,
    {
      label: label.trim() || 'Token',
      boxes: n,
      marked: 0,
    },
  ]
}

export function setCustomTrackerMarks(
  state: CharacterState,
  index: number,
  marked: number,
): TrackerState[] {
  const list = readCustomTrackers(state)
  if (index < 0 || index >= list.length) return list
  return list.map((t, i) =>
    i === index ? { ...t, marked: clampMarked(marked, t.boxes) } : t,
  )
}

export function removeCustomTracker(state: CharacterState, index: number): TrackerState[] {
  return readCustomTrackers(state).filter((_, i) => i !== index)
}

export function bumpCustomTracker(
  state: CharacterState,
  index: number,
  delta: number,
): TrackerState[] {
  const list = readCustomTrackers(state)
  const t = list[index]
  if (!t) return list
  return setCustomTrackerMarks(state, index, t.marked + delta)
}
