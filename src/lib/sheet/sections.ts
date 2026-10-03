import type { CharacterState, Playbook } from '../content/types'

export type SectionId =
  | 'identity'
  | 'appearance'
  | 'stats'
  | 'moves'
  | 'possessions'
  | 'setup'
  | 'introductions'
  | 'inserts'
  | 'arcana'
  | 'overview'

export const SECTION_LABELS: Record<SectionId, string> = {
  overview: 'Resumen',
  identity: 'Identidad',
  appearance: 'Apariencia',
  stats: 'Atributos',
  moves: 'Movimientos',
  possessions: 'Posesiones',
  setup: 'Setup',
  introductions: 'Introducciones',
  inserts: 'Inserts',
  arcana: 'Arcana',
}

/** Order of dedicated pages while creating the character (PDF-like flow). */
export const CREATION_FLOW: SectionId[] = [
  'identity',
  'appearance',
  'stats',
  'moves',
  'possessions',
  'setup',
  'introductions',
  'inserts',
]

/** Sections available once the character is in play. */
export const PLAY_FLOW: SectionId[] = [
  'overview',
  'stats',
  'moves',
  'possessions',
  'inserts',
  'arcana',
  'identity',
  'appearance',
  'setup',
  'introductions',
]

export const PRONOUN_OPTIONS = [
  { id: 'he/him', label: 'he/him' },
  { id: 'she/her', label: 'she/her' },
  { id: 'they/them', label: 'they/them' },
]

const CORE_CREATION: SectionId[] = ['identity', 'appearance', 'stats', 'moves', 'possessions']

export function evaluateSectionStatus(
  playbook: Playbook,
  state: CharacterState,
): CharacterState['section_status'] {
  const freeChoices = playbook.starting_move_rules.free_choices ?? 0
  const fixed = new Set(playbook.starting_move_rules.fixed ?? [])
  const bgGranted = new Set(
    (playbook.backgrounds.find((b) => b.id === state.identity.background_id)?.grants ?? [])
      .filter((g) => g.type === 'move')
      .map((g) => g.id),
  )
  const effectMoves = new Set(
    (
      (state.setup.background_effect_grants as { moves?: string[] } | undefined)?.moves ?? []
    ).map(String),
  )
  const pickOne = new Set(
    (playbook.starting_move_rules.choice_groups ?? []).flatMap((g) => g.options),
  )
  const chosenExtra = state.moves.selected.filter(
    (id) => !fixed.has(id) && !bgGranted.has(id) && !pickOne.has(id) && !effectMoves.has(id),
  ).length

  const statsAssigned = Object.values(state.mechanics.stats).some((v) => v !== 0)
  const appearancePicked = Object.values(state.identity.appearance).some(Boolean)

  const possessionsChoose =
    (playbook.special_possessions as { choose?: number } | undefined)?.choose ?? 0
  const effectPossessions = new Set(
    (
      (state.setup.background_effect_grants as { possessions?: string[] } | undefined)
        ?.possessions ?? []
    ).map(String),
  )
  const playerPossessions = state.possessions.selected.filter((id) => !effectPossessions.has(id))
  const possessionsDone =
    possessionsChoose === 0 || playerPossessions.length >= possessionsChoose

  // Pronouns are optional — not required for identity complete.
  // Appearance is optional too (never blocks creation).
  return {
    identity:
      state.identity.character_name &&
      state.identity.background_id &&
      state.identity.instinct_id &&
      state.identity.origin_id
        ? 'complete'
        : state.identity.character_name || state.identity.background_id
          ? 'in_progress'
          : 'not_started',
    appearance: appearancePicked ? 'complete' : 'not_started',
    stats: statsAssigned ? 'complete' : 'not_started',
    moves: chosenExtra >= freeChoices ? 'complete' : chosenExtra > 0 ? 'in_progress' : 'not_started',
    possessions: possessionsDone
      ? 'complete'
      : playerPossessions.length
        ? 'in_progress'
        : 'not_started',
    setup: Object.keys(state.setup).length ? 'complete' : 'not_started',
    introductions:
      (state.session_zero_notes.npc_connections?.length ?? 0) > 0 ||
      (state.session_zero_notes.pc_connections?.length ?? 0) > 0 ||
      !!state.session_zero_notes.contribution_to_stonetop
        ? 'complete'
        : 'not_started',
  }
}

export function isCreationReady(playbook: Playbook, state: CharacterState): boolean {
  const status = evaluateSectionStatus(playbook, state)
  return CORE_CREATION.every((id) => status[id] === 'complete')
}

export function backgroundMoveGrantIds(
  playbook: Playbook,
  backgroundId: string | null,
): string[] {
  const bg = playbook.backgrounds.find((b) => b.id === backgroundId)
  return (bg?.grants ?? []).filter((g) => g.type === 'move').map((g) => g.id)
}

/**
 * Rebuild starting moves. Extra picks may include another background's
 * signature move (Ranger taking Animal Companion while Mighty Hunter).
 * Drop leftover grants only when the *background itself* changes — see
 * `replaceBackgroundMoves`.
 */
export function startingMoveIds(playbook: Playbook, backgroundId: string | null, selected: string[]) {
  const fixed = [...(playbook.starting_move_rules.fixed ?? [])]
  const granted = backgroundMoveGrantIds(playbook, backgroundId)

  const taken = new Map<string, number>()
  const extras: string[] = []
  for (const id of selected) {
    if (fixed.includes(id) || granted.includes(id)) continue
    const move = playbook.moves.find((m) => m.id === id)
    const cap = moveRepeatCap(move)
    const n = (taken.get(id) ?? 0) + 1
    if (n > cap) continue
    taken.set(id, n)
    extras.push(id)
  }
  return [...fixed, ...granted, ...extras]
}

/** When switching backgrounds, drop the old background's granted moves, then apply the new ones. */
export function replaceBackgroundMoves(
  playbook: Playbook,
  fromBackgroundId: string | null,
  toBackgroundId: string,
  selected: string[],
): string[] {
  const oldGrants = new Set(backgroundMoveGrantIds(playbook, fromBackgroundId))
  const withoutOld = selected.filter((id) => !oldGrants.has(id))
  return startingMoveIds(playbook, toBackgroundId, withoutOld)
}

/** Matches book phrasing including “Each additional time you take this move…”. */
const TAKE_AGAIN_RE = /each(?:\s+additional)?\s+time you take this move/i

export function moveRepeatCap(move: { boxes?: number; repeatable?: boolean; rule_text?: string | null } | undefined) {
  if (!move) return 1
  if (move.repeatable || TAKE_AGAIN_RE.test(move.rule_text ?? '')) {
    return Math.max(move.boxes ?? 3, 2)
  }
  return 1
}

export function movePrintedBoxes(move: { boxes?: number; repeatable?: boolean; rule_text?: string | null } | undefined) {
  if (!move) return 1
  if ((move.boxes ?? 0) > 1) return move.boxes as number
  if (move.repeatable || TAKE_AGAIN_RE.test(move.rule_text ?? '')) return 3
  return 1
}

export function availableLevel1Moves(playbook: Playbook) {
  return playbook.moves.filter((m) => (m.min_level ?? 1) <= 1)
}
