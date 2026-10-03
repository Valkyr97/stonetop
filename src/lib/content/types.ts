export interface ContentManifest {
  version: string
  generated_on: string
  packs: ManifestPack[]
}

export interface ManifestPack {
  id: string
  file: string
  version: string
  sha256: string
  required: boolean
}

export interface CreationPack {
  _meta?: Record<string, unknown>
  character_state_schema?: Record<string, unknown>
  session_zero?: Record<string, unknown>
  content: {
    playbooks: Playbook[]
    inserts: InsertDef[]
  }
  pending_verification?: unknown[]
  validation?: Record<string, unknown>
  sources?: Record<string, unknown>
}

export interface Playbook {
  id: string
  type: string
  name: string
  /** Italic intro blurb from the playbook (CC BY-SA corpus). */
  flavor?: string
  source?: { web?: string; raw?: string }
  base: {
    damage_die: string
    max_hp: number
    stat_array: number[]
  }
  backgrounds: Background[]
  instincts: {
    id: string
    label: string
    description?: string | null
    rule_text_status?: string
    /** Write-in instinct (Splatbook `custom: true`). */
    custom?: boolean
  }[]
  appearance_groups: AppearanceGroup[]
  /** Prompt shown above origin cards (from Splatbook). */
  origins_prompt?: string | null
  origins: Origin[]
  starting_move_rules: {
    fixed?: string[]
    background_grants?: boolean
    background_additions?: boolean
    free_choices: number
    /** Pick-exactly-N groups (Splatbook `moves.starting.pickOne`). */
    choice_groups?: { choose: number; options: string[] }[]
  }
  moves: MoveDef[]
  special_possessions?: Record<string, unknown>
  playbook_setup?: Record<string, unknown>
  /** Splatbook-shaped Details sections (sacred pouch, shrine, tall tales…). */
  extras?: ExtrasSection[]
  introductions?: {
    intro?: string
    steps?: IntroStep[]
    npc_prompts?: string[]
    pc_prompts?: string[]
  }
  grants?: { type: string; id: string }[]
}

export interface IntroStep {
  n: number
  text: string
  questions?: string[]
}

export interface ExtrasSection {
  id: string
  title: string
  text?: string
  lines?: string[][]
  choices?: ExtrasChoice[]
  prompts?: string[]
}

export interface ExtrasChoice {
  id: string
  prompt: string
  min: number
  max: number
  options: { label: string; grantsMove?: string }[]
}

export interface ExtrasSectionState {
  lines?: (string | null)[]
  choices?: Record<string, { selected: string[]; writeIn?: string }>
  prompts?: Record<number | string, string>
}

export interface Background {
  id: string
  name: string
  grants?: { type: string; id: string }[]
  creation_fields?: CreationField[]
  /** Authoritative prose from CC BY-SA corpus (may be null if unmatched). */
  rule_text?: string | null
  rule_text_status?: string
}

export interface AppearanceGroup {
  id: string
  type: string
  options: { id: string; label: string }[]
}

export interface Origin {
  id: string
  label: string
  /** Optional note under the origin label (e.g. Gordin's Delve). */
  note?: string
  name_options?: { id: string; label: string }[]
  name_generation?: {
    type: string
    min_tokens: number
    max_tokens: number
    tokens: string[]
  }
}

export interface MoveDef {
  id: string
  name: string
  min_level?: number
  requires?: string[]
  replaces?: string | null
  creation_fields?: CreationField[]
  tags?: string[]
  /**
   * Empty squares next to the move name.
   * May mean take-again capacity OR a play-use track — prefer `tracker` for the latter.
   */
  boxes?: number
  /** Spendable / markable play track (uses, Resolve, Consequence sinks, etc.). */
  tracker?: { boxes: number; label?: string }
  repeatable?: boolean
  rule_text?: string | null
  rule_text_status?: string
}

export interface CreationField {
  key: string
  type: string
  min?: number
  max?: number
  initial?: number
  options?: string[] | { id: string; label: string }[]
  option_groups?: string[][]
  status?: string
  target?: string
  [key: string]: unknown
}

export interface InsertDef {
  id: string
  type: string
  name: string
  source?: { web?: string; raw?: string }
  creation_required?: boolean
  granted_to_all?: boolean
  /** Auto-attach condition, checked against the character + playbook. */
  creation_required_when?: {
    character_has_move?: string
    playbook?: string
    background?: string
  } & Record<string, unknown>
  /**
   * Inserts with no auto-attach condition and no `manual: true` flag are
   * still available to add via the player's own "+" menu (Splatbook's
   * default). `manual: true` additionally gates the insert behind a GM hang
   * (`content_grants` with `content_type: 'insert'`) before it can be
   * attached at all — used for followers / the undead trio / freeform
   * arcana-adjacent inserts that are narratively GM-granted.
   */
  manual?: boolean
  note?: string
  /** Authoritative prose from the CC BY-SA corpus (may be absent/null if unmatched). */
  rule_text?: string | null
  rule_text_status?: string
  state_schema?: Record<string, unknown>
  common_fields?: Record<string, unknown>
  types?: unknown[]
  known_verified_entries?: unknown[]
  members?: { id: string; name: string }[]
  /** Present on initiates-of-danu; the UI reads this (not `members`). */
  initiates?: { id: string; name: string; fields?: Record<string, unknown> }[]
  [key: string]: unknown
}

export interface ArcanaPack {
  _meta?: Record<string, unknown>
  arcana: {
    minor: ArcanaCard[]
    major: ArcanaCard[]
  }
}

export interface ArcanaCard {
  id: string
  ordinal: number
  type: 'minor_arcanum' | 'major_arcanum'
  name: string
  grantable?: boolean
  source_ref?: string
  controls?: ArcanaControl[]
  faces?: string[]
  progress?: Record<string, unknown>
  resources?: Record<string, unknown>[]
  consequences?: Record<string, unknown>
  mechanic_notes?: string[]
  normalization_status?: string
  rule_text?: string | null
  pending?: string[]
}

/** Bumped whenever the persisted `CharacterState` shape changes in a way
 * that needs migration. See `sheet/engine/migrate.ts`.
 * v1: original shape (`mechanics.debilities` was a free-form string[]).
 * v2: `mechanics.debilities` becomes the book's three fixed conditions;
 *     adds `mechanics.advancement`, `mechanics.trackers`,
 *     `mechanics.flags`. */
export const CHARACTER_SCHEMA_VERSION = 3

/** A box-tracker instance on a sheet (move use-boxes, Improved Stat's
 * repeat boxes, Potential for Greatness's marks, etc). Keyed by move id on
 * `CharacterState.mechanics.trackers`. */
export interface TrackerState {
  label: string
  boxes: number
  marked: number
}

/** One move gained on Level Up. `stat` records which stat an Improved/
 * Superior Stat pick raised; `replaced` names a move this pick retires
 * (e.g. A Mighty Rampart replacing Bulwark). */
export interface AdvancementEntry {
  level: number
  moveId: string
  stat?: string
  replaced?: string | null
}

/** The book's three debilities. Each covers a linked stat pair (Harm &
 * Healing rules): STR/DEX -> weakened, INT/WIS -> dazed, CON/CHA ->
 * miserable. */
export interface DebilitiesState {
  weakened: boolean
  dazed: boolean
  miserable: boolean
}

export interface ArcanaControl {
  key: string
  type: string | null
  count?: number
  max?: number
  min?: number
  slots?: number
  status?: string
  reason?: string
  mutable_after_unlock?: boolean
}

export interface CharacterState {
  /** Absent/undefined means schema v1 (pre-migration draft). */
  schema_version?: number
  identity: {
    character_name: string
    pronouns: string
    playbook_id: string
    background_id: string | null
    instinct_id: string | null
    /** Free-text when instinct_id is the custom write-in. */
    instinct_write_in?: string
    origin_id: string | null
    name_source: 'suggested' | 'custom'
    appearance: Record<string, string>
  }
  mechanics: {
    stats: Record<string, number>
    debilities: DebilitiesState
    hp_current: number
    armor: number
    /** Unspent XP pool; surplus past a level-up's cost simply stays here. */
    xp: number
    level: number
    damage_die: string
    max_hp: number
    /** Level-up log; see `AdvancementEntry`. */
    advancement: AdvancementEntry[]
    /** Use-box trackers for held moves, keyed by move id. */
    trackers: Record<string, TrackerState>
    /**
     * Player-created token trackers (Readiness, house holds, etc.).
     * Not wiped by move tracker sync.
     */
    customTrackers?: TrackerState[]
    /** Small one-off narrative flags (e.g. `would-be-crossed`). */
    flags: Record<string, boolean>
  }
  moves: {
    selected: string[]
  }
  possessions: {
    selected: string[]
    custom?: string
    details?: Record<string, unknown>
  }
  setup: Record<string, unknown>
  inserts: Record<string, unknown>
  session_zero_notes: {
    contribution_to_stonetop?: string
    literacy?: Record<string, unknown>
    family?: Record<string, unknown>
    home?: Record<string, unknown>
    npc_connections?: { prompt_id: string; answer_name: string; notes?: string }[]
    pc_connections?: {
      prompt_id: string
      target_character_id?: string | null
      target_character_name?: string | null
      notes?: string
    }[]
  }
  section_status: Record<string, 'not_started' | 'in_progress' | 'complete'>
  /** false while stepping through creation views; true switches to play layout. */
  creation_complete: boolean
}

export function emptyCharacterState(playbook: Playbook): CharacterState {
  const stats: Record<string, number> = {
    STR: 0,
    DEX: 0,
    INT: 0,
    WIS: 0,
    CON: 0,
    CHA: 0,
  }
  return {
    schema_version: CHARACTER_SCHEMA_VERSION,
    identity: {
      character_name: '',
      pronouns: '',
      playbook_id: playbook.id,
      background_id: null,
      instinct_id: null,
      origin_id: null,
      name_source: 'suggested',
      appearance: {},
    },
    mechanics: {
      stats,
      debilities: { weakened: false, dazed: false, miserable: false },
      hp_current: playbook.base.max_hp,
      armor: 0,
      xp: 0,
      level: 1,
      damage_die: playbook.base.damage_die,
      max_hp: playbook.base.max_hp,
      advancement: [],
      trackers: {},
      customTrackers: [],
      flags: {},
    },
    moves: { selected: [...(playbook.starting_move_rules.fixed ?? [])] },
    possessions: { selected: [], details: {} },
    setup: {},
    inserts: {},
    session_zero_notes: {
      npc_connections: [],
      pc_connections: [],
    },
    section_status: {
      identity: 'not_started',
      appearance: 'not_started',
      stats: 'not_started',
      moves: 'not_started',
      possessions: 'not_started',
      setup: 'not_started',
      introductions: 'not_started',
    },
    creation_complete: false,
  }
}
