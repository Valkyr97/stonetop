/**
 * Step order, English labels, and per-step "is this step actually
 * complete" validators for the creation wizard. Stricter than the old
 * pager's `CORE_CREATION` gate (moves/possessions must hit their exact
 * counts, stats must be the printed array, background fields are
 * checked) — see plan Phase 3.
 */
import type { Background, CharacterState, CreationField, Playbook } from '../../content/types'
import { isStatArrayComplete, type StatAssignments } from '../engine/stats'
import {
  WELL_VERSED_MOVE_ID,
  wellVersedTopicsValid,
} from '../engine/wellVersed'

export type WizardStepId =
  | 'background'
  | 'instinct'
  | 'appearance'
  | 'origin'
  | 'stats'
  | 'moves'
  | 'possessions'
  | 'details'
  | 'introductions'
  | 'review'

export const WIZARD_STEPS: { id: WizardStepId; label: string }[] = [
  { id: 'background', label: 'Background' },
  { id: 'instinct', label: 'Instinct' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'origin', label: 'Origin' },
  { id: 'stats', label: 'Stats' },
  { id: 'moves', label: 'Moves' },
  { id: 'possessions', label: 'Possessions' },
  { id: 'details', label: 'Details' },
  { id: 'introductions', label: 'Introductions' },
  { id: 'review', label: 'Review' },
]

/** Playbook pick is step 1 (CharacterNew); wizard steps follow. */
export const CREATION_STEP_COUNT = 1 + WIZARD_STEPS.length

/** 1-based display index for a wizard step, including the playbook step. */
export function creationStepNumber(wizardStepIndex: number): number {
  return wizardStepIndex + 2
}

/** Progress fraction in [0, 1], matching Splatbook: step k of n → k/n. */
export function creationProgress(stepNumber: number): number {
  if (CREATION_STEP_COUNT <= 0) return 0
  return Math.min(1, Math.max(0, stepNumber / CREATION_STEP_COUNT))
}

/** Steps that must validate before Finish is allowed. Appearance,
 * Details, and Introductions stay optional/narrative. */
const REQUIRED_STEPS: WizardStepId[] = [
  'background',
  'instinct',
  'origin',
  'stats',
  'moves',
  'possessions',
]

export function backgroundFieldsValid(bg: Background, fieldValues: Record<string, unknown>): boolean {
  for (const field of bg.creation_fields ?? []) {
    if (!fieldRequirementMet(field, fieldValues[field.key])) return false
  }
  return true
}

function fieldRequirementMet(field: CreationField, value: unknown): boolean {
  if (field.type === 'single_choice' || field.type === 'single_choice_reference') {
    return typeof value === 'string' && value.length > 0
  }
  if (field.type === 'multi_choice') {
    const min = (field.min as number | undefined) ?? 1
    return Array.isArray(value) && value.length >= min
  }
  // counter / other field types always have a usable default.
  return true
}

function statsMatchArray(playbook: Playbook, state: CharacterState): boolean {
  // Compare against the pre-bump base assignment, not `mechanics.stats` —
  // an Improved/Superior Stat pick on the Moves step legitimately raises
  // `mechanics.stats` above the printed array (see `wizard/statBumps.ts`).
  // Missing keys mean "not assigned yet" (Splatbook-style picker).
  const base = (state.setup.stat_base as StatAssignments | undefined) ?? {}
  return isStatArrayComplete(playbook.base.stat_array, base)
}

function effectGrantIds(
  state: CharacterState,
  kind: 'moves' | 'possessions',
): Set<string> {
  const raw = state.setup.background_effect_grants as
    | { moves?: string[]; possessions?: string[] }
    | undefined
  return new Set((raw?.[kind] ?? []).map(String))
}

export function extraPossessionIds(state: CharacterState): Set<string> {
  return effectGrantIds(state, 'possessions')
}

export function playerPossessionPicks(state: CharacterState): string[] {
  const extra = extraPossessionIds(state)
  return state.possessions.selected.filter((id) => !extra.has(id))
}

function extraMovesChosen(playbook: Playbook, state: CharacterState): number {
  const fixed = new Set(playbook.starting_move_rules.fixed ?? [])
  const bgGranted = new Set(
    (playbook.backgrounds.find((b) => b.id === state.identity.background_id)?.grants ?? [])
      .filter((g) => g.type === 'move')
      .map((g) => g.id),
  )
  const pickOne = new Set(
    (playbook.starting_move_rules.choice_groups ?? []).flatMap((g) => g.options),
  )
  const effectMoves = effectGrantIds(state, 'moves')
  return state.moves.selected.filter(
    (id) =>
      !fixed.has(id) && !bgGranted.has(id) && !pickOne.has(id) && !effectMoves.has(id),
  ).length
}

function pickOneGroupsValid(playbook: Playbook, state: CharacterState): boolean {
  const groups = playbook.starting_move_rules.choice_groups ?? []
  if (!groups.length) return true
  const selected = new Set(state.moves.selected)
  return groups.every((g) => {
    const n = g.options.filter((id) => selected.has(id)).length
    return n === (g.choose ?? 1)
  })
}

function startingMoveFieldsValid(playbook: Playbook, state: CharacterState): boolean {
  const moveFields =
    (state.setup.move_fields as Record<string, Record<string, unknown>> | undefined) ?? {}
  for (const moveId of state.moves.selected) {
    const move = playbook.moves.find((m) => m.id === moveId)
    if (!move) continue
    if (moveId === WELL_VERSED_MOVE_ID) {
      if (!wellVersedTopicsValid(playbook, state)) return false
      continue
    }
    const values = moveFields[moveId] ?? {}
    for (const field of move.creation_fields ?? []) {
      if (field.key === 'stat') continue
      if (!fieldRequirementMet(field, values[field.key])) return false
    }
  }
  return true
}

export function stepValid(id: WizardStepId, playbook: Playbook, state: CharacterState): boolean {
  switch (id) {
    case 'background': {
      const bg = playbook.backgrounds.find((b) => b.id === state.identity.background_id)
      if (!bg) return false
      const fieldValues = (state.setup.background_fields as Record<string, unknown>) ?? {}
      return backgroundFieldsValid(bg, fieldValues)
    }
    case 'instinct': {
      if (!state.identity.instinct_id) return false
      const instinct = playbook.instincts.find((i) => i.id === state.identity.instinct_id)
      if (instinct?.custom) return (state.identity.instinct_write_in ?? '').trim().length > 0
      return true
    }
    case 'origin':
      return state.identity.character_name.trim().length > 0 && !!state.identity.origin_id
    case 'appearance':
      // Optional — blanks are fine; write-ins / picks are cosmetic.
      return true
    case 'stats':
      return statsMatchArray(playbook, state)
    case 'moves':
      return (
        extraMovesChosen(playbook, state) === (playbook.starting_move_rules.free_choices ?? 0) &&
        pickOneGroupsValid(playbook, state) &&
        startingMoveFieldsValid(playbook, state)
      )
    case 'possessions': {
      const choose =
        (playbook.special_possessions as { choose?: number } | undefined)?.choose ?? 0
      if (choose === 0) return true
      return playerPossessionPicks(state).length === choose
    }
    case 'details':
    case 'introductions':
    case 'review':
      return true
  }
}

export function readyToFinish(playbook: Playbook, state: CharacterState): boolean {
  return REQUIRED_STEPS.every((id) => stepValid(id, playbook, state))
}

export function firstIncompleteStep(playbook: Playbook, state: CharacterState): WizardStepId {
  for (const step of WIZARD_STEPS) {
    if (step.id === 'review') break
    if (REQUIRED_STEPS.includes(step.id) && !stepValid(step.id, playbook, state)) return step.id
  }
  return 'review'
}
