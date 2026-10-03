/**
 * Shared Well Versed topic marks (book checklist).
 * Background grants/picks lock topics; each take of the move adds quota
 * (1 on first take, +2 per retake) for additional marks.
 */
import type { Background, CharacterState, Playbook } from '../../content/types'
import { heldCountForMove } from './moves'

export const WELL_VERSED_MOVE_ID = 'well-versed'

/** Canonical topic ids from the Seeker playbook / creation pack. */
export const WELL_VERSED_TOPICS = [
  { id: 'last-door-death-undead', label: 'The Last Door, death, and the undead' },
  { id: 'civilizations-of-humanity', label: 'The civilizations of humanity' },
  { id: 'fae', label: 'The Fae and their strange ways' },
  { id: 'makers', label: 'The Makers and their arts' },
  { id: 'primordial-powers', label: 'The primordial powers' },
  { id: 'things-below', label: 'The Things Below' },
  { id: 'wild-world-spirits', label: 'The wild world and its spirits' },
] as const

export type WellVersedTopicId = (typeof WELL_VERSED_TOPICS)[number]['id']

const TOPIC_IDS = new Set<string>(WELL_VERSED_TOPICS.map((t) => t.id))

export function topicLabel(id: string): string {
  return WELL_VERSED_TOPICS.find((t) => t.id === id)?.label ?? id
}

/** How many topics the move itself lets you mark (beyond background). */
export function moveTopicQuota(takes: number): number {
  if (takes <= 0) return 0
  return 1 + (takes - 1) * 2
}

/** Rebuild from legacy split fields when `well_versed_topics` is absent. */
export function hydrateMarkedTopics(state: CharacterState): string[] {
  const out: string[] = []
  const bgFields = (state.setup.background_fields as Record<string, unknown> | undefined) ?? {}
  const bgTopic = bgFields.background_topic
  if (typeof bgTopic === 'string' && TOPIC_IDS.has(bgTopic)) out.push(bgTopic)

  const moveFields =
    (state.setup.move_fields as Record<string, Record<string, unknown>> | undefined)?.[
      WELL_VERSED_MOVE_ID
    ] ?? {}
  const additional = moveFields.additional_topic
  if (typeof additional === 'string' && TOPIC_IDS.has(additional)) out.push(additional)
  else if (Array.isArray(additional)) {
    for (const id of additional) {
      if (typeof id === 'string' && TOPIC_IDS.has(id)) out.push(id)
    }
  }
  return [...new Set(out)]
}

export function readMarkedTopics(state: CharacterState): string[] {
  const raw = state.setup.well_versed_topics
  if (Array.isArray(raw)) {
    return [...new Set(raw.map(String).filter((id) => TOPIC_IDS.has(id)))]
  }
  return hydrateMarkedTopics(state)
}

/** Topics granted/chosen by the current background — shown marked & locked. */
export function lockedTopicsFromBackground(
  playbook: Playbook,
  state: CharacterState,
): string[] {
  const bg = playbook.backgrounds.find((b) => b.id === state.identity.background_id)
  if (!bg) return []
  const locked: string[] = []
  for (const g of bg.grants ?? []) {
    if (g.type === 'well_versed_topic' && TOPIC_IDS.has(g.id)) locked.push(g.id)
  }
  const fields = (state.setup.background_fields as Record<string, unknown> | undefined) ?? {}
  const pick = fields.background_topic
  if (typeof pick === 'string' && TOPIC_IDS.has(pick)) locked.push(pick)
  return [...new Set(locked)]
}

export function playerMarkedTopics(playbook: Playbook, state: CharacterState): string[] {
  const locked = new Set(lockedTopicsFromBackground(playbook, state))
  return readMarkedTopics(state).filter((id) => !locked.has(id))
}

export function wellVersedTakes(playbook: Playbook, state: CharacterState): number {
  if (!state.moves.selected.includes(WELL_VERSED_MOVE_ID) &&
      !state.mechanics.advancement.some((e) => e.moveId === WELL_VERSED_MOVE_ID)) {
    return 0
  }
  return heldCountForMove(state, playbook, WELL_VERSED_MOVE_ID)
}

function writeTopics(draft: CharacterState, playbook: Playbook, topics: string[]): void {
  const locked = lockedTopicsFromBackground(playbook, draft)
  const lockedSet = new Set(locked)
  const unique = [...new Set([...locked, ...topics.filter((id) => TOPIC_IDS.has(id))])]
  draft.setup.well_versed_topics = unique

  const playerOnly = unique.filter((id) => !lockedSet.has(id))
  const all = {
    ...((draft.setup.move_fields as Record<string, Record<string, unknown>> | undefined) ?? {}),
  }
  const prevMove = { ...(all[WELL_VERSED_MOVE_ID] ?? {}) }
  if (playerOnly.length === 0) delete prevMove.additional_topic
  else if (playerOnly.length === 1) prevMove.additional_topic = playerOnly[0]
  else prevMove.additional_topic = playerOnly
  all[WELL_VERSED_MOVE_ID] = prevMove
  draft.setup.move_fields = all
}

/**
 * Recompute locked background topics into `setup.well_versed_topics`,
 * keeping player marks that are still free (trimmed to current quota).
 */
export function syncWellVersedTopics(draft: CharacterState, playbook: Playbook): void {
  const locked = lockedTopicsFromBackground(playbook, draft)
  const lockedSet = new Set(locked)
  const player = readMarkedTopics(draft).filter((id) => !lockedSet.has(id))
  const quota = moveTopicQuota(wellVersedTakes(playbook, draft))
  writeTopics(draft, playbook, [...locked, ...player.slice(0, quota)])
}

/**
 * Toggle a player-markable topic. Locked (background) topics cannot change.
 * Enforces move quota.
 */
export function togglePlayerTopic(
  draft: CharacterState,
  playbook: Playbook,
  topicId: string,
): void {
  if (!TOPIC_IDS.has(topicId)) return
  const locked = new Set(lockedTopicsFromBackground(playbook, draft))
  if (locked.has(topicId)) return

  const quota = moveTopicQuota(wellVersedTakes(playbook, draft))
  if (quota <= 0) return

  const current = readMarkedTopics(draft)
  const on = current.includes(topicId)
  let next: string[]
  if (on) {
    next = current.filter((id) => id !== topicId)
  } else {
    const playerCount = current.filter((id) => !locked.has(id)).length
    if (playerCount >= quota) return
    next = [...current, topicId]
  }
  writeTopics(draft, playbook, next)
}

/** True when Well Versed is held and player marks meet the current quota. */
export function wellVersedTopicsValid(playbook: Playbook, state: CharacterState): boolean {
  const takes = wellVersedTakes(playbook, state)
  if (takes <= 0) return true
  const quota = moveTopicQuota(takes)
  const locked = lockedTopicsFromBackground(playbook, state)
  const bg = playbook.backgrounds.find((b) => b.id === state.identity.background_id)
  const needsBgPick = (bg?.creation_fields ?? []).some((f) => f.key === 'background_topic')
  if (needsBgPick && locked.length === 0) return false

  const player = playerMarkedTopics(playbook, state)
  return player.length === quota
}

/** Background grant helper used by sims / diagnostics. */
export function backgroundWellVersedGrantIds(bg: Background | undefined): string[] {
  if (!bg) return []
  return (bg.grants ?? [])
    .filter((g) => g.type === 'well_versed_topic' && TOPIC_IDS.has(g.id))
    .map((g) => g.id)
}
