/**
 * Upgrades a persisted `CharacterState` blob (from IndexedDB or a claimed
 * character pulled from Supabase) to the current schema. Always run this
 * before handing a loaded draft to the wizard or play binder.
 */
import { CHARACTER_SCHEMA_VERSION, type CharacterState, type DebilitiesState } from '../../content/types'
import { hydrateMarkedTopics } from './wellVersed'

function migrateDebilities(raw: unknown): DebilitiesState {
  if (Array.isArray(raw)) {
    const set = new Set(raw as string[])
    return {
      weakened: set.has('weakened'),
      dazed: set.has('dazed'),
      miserable: set.has('miserable'),
    }
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    return {
      weakened: !!obj.weakened,
      dazed: !!obj.dazed,
      miserable: !!obj.miserable,
    }
  }
  return { weakened: false, dazed: false, miserable: false }
}

/** Idempotent: safe to call on an already-current draft. */
export function migrateCharacterState(raw: unknown): CharacterState {
  const state = (raw ?? {}) as Partial<CharacterState> & {
    mechanics?: Partial<CharacterState['mechanics']> & { debilities?: unknown }
  }
  const mechanics = state.mechanics ?? ({} as CharacterState['mechanics'])

  const migrated: CharacterState = {
    ...(state as CharacterState),
    schema_version: CHARACTER_SCHEMA_VERSION,
    identity: {
      character_name: '',
      pronouns: '',
      playbook_id: '',
      background_id: null,
      instinct_id: null,
      origin_id: null,
      name_source: 'suggested',
      appearance: {},
      ...state.identity,
    },
    mechanics: {
      stats: mechanics.stats ?? {},
      debilities: migrateDebilities(mechanics.debilities),
      hp_current: mechanics.hp_current ?? 0,
      armor: mechanics.armor ?? 0,
      xp: mechanics.xp ?? 0,
      level: mechanics.level ?? 1,
      damage_die: mechanics.damage_die ?? 'd6',
      max_hp: mechanics.max_hp ?? 0,
      advancement: mechanics.advancement ?? [],
      trackers: mechanics.trackers ?? {},
      customTrackers: Array.isArray(mechanics.customTrackers) ? mechanics.customTrackers : [],
      flags: mechanics.flags ?? {},
    },
    moves: { selected: state.moves?.selected ?? [] },
    possessions: { selected: [], details: {}, ...state.possessions },
    setup: state.setup ?? {},
    inserts: state.inserts ?? {},
    session_zero_notes: { npc_connections: [], pc_connections: [], ...state.session_zero_notes },
    section_status: state.section_status ?? {},
    creation_complete: state.creation_complete ?? false,
  }

  // Hydrate shared Well Versed marks from legacy split fields when absent.
  if (!Array.isArray(migrated.setup.well_versed_topics)) {
    const topics = hydrateMarkedTopics(migrated)
    if (topics.length) migrated.setup.well_versed_topics = topics
  }

  // Older level-ups also wrote the pick into moves.selected, which made
  // heldMoveIds list the same move twice (creation list + advancement log).
  migrated.moves.selected = stripAdvancementDupesFromSelected(
    migrated.moves.selected,
    migrated.mechanics.advancement,
  )

  return migrated
}

/**
 * Drop selected copies that are already accounted for by advancement entries
 * (one selected occurrence removed per matching advancement pick).
 */
export function stripAdvancementDupesFromSelected(
  selected: string[],
  advancement: { moveId: string }[],
): string[] {
  const owed = new Map<string, number>()
  for (const entry of advancement) {
    owed.set(entry.moveId, (owed.get(entry.moveId) ?? 0) + 1)
  }
  const out: string[] = []
  for (const id of selected) {
    const n = owed.get(id) ?? 0
    if (n > 0) {
      owed.set(id, n - 1)
      continue
    }
    out.push(id)
  }
  return out
}

/** Cheap check used to skip migration work on state that's already current. */
export function needsMigration(raw: unknown): boolean {
  const state = raw as { schema_version?: number } | null | undefined
  return (state?.schema_version ?? 0) < CHARACTER_SCHEMA_VERSION
}
