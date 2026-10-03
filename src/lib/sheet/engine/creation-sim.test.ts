/**
 * Exhaustive headless simulation: every mechanical PC creation combination
 * (playbook × background × background-fields × starting moves × possessions)
 * plus narrative option coverage and advancement reachability, against the
 * live creation pack + MyVersion engine. No UI.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  Background,
  CharacterState,
  CreationField,
  CreationPack,
  Playbook,
} from '../../content/types'
import { emptyCharacterState } from '../../content/types'
import {
  applyLevelUp,
  canLevelUp,
  legalLevelUpMoves,
  xpForNextLevel,
} from './advancement'
import { attachAutoInserts } from './inserts'
import {
  choosableMoves,
  isStatBumpMove,
  startingMovesPlan,
  freeChosenMoves,
  heldMoveIds,
} from './moves'
import {
  WELL_VERSED_TOPICS,
  lockedTopicsFromBackground,
  moveTopicQuota,
  syncWellVersedTopics,
  wellVersedTakes,
} from './wellVersed'
import { syncTrackers } from './trackers'
import { applyBackgroundSelectionEffects } from '../wizard/backgroundEffects'
import { applyStatBumps } from '../wizard/statBumps'
import { readyToFinish, stepValid } from '../wizard/steps'
import { startingMoveIds } from '../sections'
import type { StatKey } from './stats'

const pack: CreationPack = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../content/packs/creation-v0.1.json'), 'utf8'),
)

const STAT_KEYS: StatKey[] = ['STR', 'DEX', 'INT', 'WIS', 'CON', 'CHA']

type Issue = {
  severity: 'error' | 'warn'
  playbook: string
  background?: string
  path: string
  message: string
}

type SimReport = {
  packVersion: unknown
  /** Passes current wizard readyToFinish */
  createdOk: number
  createdFail: number
  /** Passes book-correct finish (selection_effect is additional) */
  bookCorrectOk: number
  bookCorrectFail: number
  /** Engine finish fails but book-correct would pass — selection_effect slot bug */
  engineUndercountsExtras: number
  narrativeOk: number
  narrativeFail: number
  advancementTried: number
  advancementOk: number
  advancementFail: number
  unreachableAdvancements: { playbook: string; moveId: string; name: string; reason: string }[]
  contentIssues: Issue[]
  creationFailures: Issue[]
  advancementFailures: Issue[]
  grantGaps: Issue[]
  counts: Record<string, unknown>
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  const out: T[][] = []
  const rec = (start: number, chosen: T[]) => {
    if (chosen.length === k) {
      out.push([...chosen])
      return
    }
    for (let i = start; i <= arr.length - (k - chosen.length); i++) {
      chosen.push(arr[i]!)
      rec(i + 1, chosen)
      chosen.pop()
    }
  }
  rec(0, [])
  return out
}

function optionIds(field: CreationField): string[] {
  const flat = field.options ?? field.option_groups?.flat() ?? []
  return flat.map((o) => (typeof o === 'string' ? o : (o as { id: string }).id))
}

/**
 * Valid assignments for background creation_fields.
 * Large multi_choice spaces (e.g. Destined destiny_tokens C(25,3)+C(25,4))
 * are sampled so the sim stays tractable while still exercising the field.
 */
function enumerateFieldAssignments(
  fields: CreationField[] | undefined,
): Record<string, unknown>[] {
  if (!fields?.length) return [{}]
  let assignments: Record<string, unknown>[] = [{}]
  for (const field of fields) {
    const opts = optionIds(field)
    const next: Record<string, unknown>[] = []
    if (field.type === 'single_choice' || field.type === 'single_choice_reference') {
      for (const base of assignments) {
        for (const id of opts) next.push({ ...base, [field.key]: id })
      }
    } else if (field.type === 'multi_choice') {
      const min = field.min ?? 1
      const max = field.max ?? opts.length
      let picks: string[][] = []
      for (let k = min; k <= Math.min(max, opts.length); k++) picks.push(...combinations(opts, k))
      // Cap explosion (Destined tokens ≈ 28k alone).
      if (picks.length > 24) {
        picks = [
          opts.slice(0, min),
          opts.slice(0, Math.min(max, opts.length)),
          opts.slice(-min),
          ...picks.filter((_, i) => i % Math.ceil(picks.length / 20) === 0),
        ].filter((p, i, arr) => arr.findIndex((q) => q.join() === p.join()) === i)
      }
      for (const base of assignments) {
        for (const pick of picks) next.push({ ...base, [field.key]: pick })
      }
    } else {
      for (const base of assignments) {
        next.push({ ...base, [field.key]: field.initial ?? 0 })
      }
    }
    assignments = next.length ? next : assignments
  }
  return assignments
}

/** Player-facing possession count excluding background selection_effect grants. */
function playerPossessionCount(state: CharacterState): number {
  const effect =
    (state.setup.background_effect_grants as { possessions?: string[] } | undefined)?.possessions ??
    []
  const effectSet = new Set(effect)
  return state.possessions.selected.filter((id) => !effectSet.has(id)).length
}

/** Player-facing free-move count excluding selection_effect grants. */
function playerExtraMoveCount(playbook: Playbook, state: CharacterState): number {
  const effect =
    (state.setup.background_effect_grants as { moves?: string[] } | undefined)?.moves ?? []
  const effectSet = new Set(effect)
  const fixed = new Set(playbook.starting_move_rules.fixed ?? [])
  const bgGranted = new Set(
    (playbook.backgrounds.find((b) => b.id === state.identity.background_id)?.grants ?? [])
      .filter((g) => g.type === 'move')
      .map((g) => g.id),
  )
  const pickOne = new Set(
    (playbook.starting_move_rules.choice_groups ?? []).flatMap((g) => g.options),
  )
  return state.moves.selected.filter(
    (id) =>
      !fixed.has(id) &&
      !bgGranted.has(id) &&
      !pickOne.has(id) &&
      !effectSet.has(id),
  ).length
}

/** Book-correct finish check: selection_effect grants are *additional*. */
function readyToFinishBookCorrect(playbook: Playbook, state: CharacterState): boolean {
  const stepsOk = (
    ['background', 'instinct', 'appearance', 'origin', 'stats'] as const
  ).every((id) => stepValid(id, playbook, state))
  if (!stepsOk) return false
  const free = playbook.starting_move_rules.free_choices ?? 0
  const movesOk =
    playerExtraMoveCount(playbook, state) === free &&
    (playbook.starting_move_rules.choice_groups ?? []).every((g) => {
      const n = g.options.filter((id) => state.moves.selected.includes(id)).length
      return n === (g.choose ?? 1)
    })
  const choose = possessionChoose(playbook)
  const possOk = choose === 0 || playerPossessionCount(state) === choose
  return movesOk && possOk
}

function possessionOptions(playbook: Playbook): { id: string; custom?: boolean }[] {
  return (
    (
      playbook.special_possessions as
        | { options?: { id: string; custom?: boolean }[] }
        | undefined
    )?.options ?? []
  )
}

function possessionChoose(playbook: Playbook): number {
  return (playbook.special_possessions as { choose?: number } | undefined)?.choose ?? 0
}

function assignPrintedStats(playbook: Playbook, state: CharacterState): void {
  const values = [...playbook.base.stat_array]
  const base: Record<string, number> = {}
  for (let i = 0; i < STAT_KEYS.length; i++) base[STAT_KEYS[i]!] = values[i] ?? 0
  state.setup.stat_base = { ...base }
  state.mechanics.stats = { ...base }
}

function fillNarrativeDefaults(playbook: Playbook, state: CharacterState): void {
  const instinct = playbook.instincts.find((i) => !i.custom) ?? playbook.instincts[0]
  state.identity.instinct_id = instinct?.id ?? null
  if (instinct?.custom) state.identity.instinct_write_in = 'sim-custom'
  state.identity.origin_id = playbook.origins[0]?.id ?? null
  state.identity.character_name = `Sim ${playbook.name}`
  state.identity.pronouns = 'they/them'
  for (const g of playbook.appearance_groups) {
    state.identity.appearance[g.id] = g.options[0]?.id ?? ''
  }
}

/** Fill required single/multi choice creation_fields on held starting moves. */
function fillStartingMoveFields(playbook: Playbook, state: CharacterState): void {
  const all: Record<string, Record<string, unknown>> = {
    ...((state.setup.move_fields as Record<string, Record<string, unknown>> | undefined) ?? {}),
  }
  for (const moveId of state.moves.selected) {
    const move = playbook.moves.find((m) => m.id === moveId)
    if (!move) continue
    if (moveId === 'well-versed') {
      // Shared checklist: mark quota of unlocked topics after background locks.
      syncWellVersedTopics(state, playbook)
      const locked = new Set(lockedTopicsFromBackground(playbook, state))
      const quota = moveTopicQuota(wellVersedTakes(playbook, state))
      const marked = [...locked]
      for (const t of WELL_VERSED_TOPICS) {
        if (marked.length - locked.size >= quota) break
        if (!locked.has(t.id)) marked.push(t.id)
      }
      state.setup.well_versed_topics = marked
      syncWellVersedTopics(state, playbook)
      continue
    }
    const values = { ...(all[moveId] ?? {}) }
    for (const field of move.creation_fields ?? []) {
      if (field.key === 'stat') continue
      if (field.type === 'single_choice' || field.type === 'single_choice_reference') {
        const opt = field.options?.[0]
        if (!opt) continue
        values[field.key] = typeof opt === 'string' ? opt : opt.id
      } else if (field.type === 'multi_choice') {
        const min = field.min ?? 1
        const opts = (field.options ?? [])
          .slice(0, min)
          .map((o) => (typeof o === 'string' ? o : o.id))
        values[field.key] = opts
      }
    }
    all[moveId] = values
  }
  const final = { ...all }
  const wv = (
    state.setup.move_fields as Record<string, Record<string, unknown>> | undefined
  )?.['well-versed']
  if (wv) final['well-versed'] = wv
  state.setup.move_fields = final
}

/** Free-move combos; exclude ids already taken via selection_effect fields. */
function enumerateMovePicks(
  playbook: Playbook,
  backgroundId: string,
  fields: Record<string, unknown> = {},
): string[][] {
  const plan = startingMovesPlan(playbook, backgroundId)
  const bg = playbook.backgrounds.find((b) => b.id === backgroundId)
  const effectIds = new Set<string>()
  for (const g of bg?.grants ?? []) {
    if (g.type !== 'selection_effect') continue
    const from = (g as { from?: string }).from
    if (!from) continue
    const val = fields[from]
    const picks = Array.isArray(val) ? val.map(String) : typeof val === 'string' && val ? [val] : []
    for (const id of picks) effectIds.add(id)
  }
  const freePool = choosableMoves(playbook, backgroundId)
    .map((m) => m.id)
    .filter((id) => !effectIds.has(id))
  const freeCombos =
    plan.chooseCount === 0 ? [[]] : combinations(freePool, plan.chooseCount)

  const groupCombos: string[][][] = (playbook.starting_move_rules.choice_groups ?? []).map((g) =>
    combinations(g.options, g.choose ?? 1),
  )

  let acc: string[][] = freeCombos.map((f) => [...f])
  for (const group of groupCombos) {
    const next: string[][] = []
    for (const prev of acc) {
      for (const pick of group) next.push([...prev, ...pick])
    }
    acc = next
  }
  return acc
}

function enumeratePossessionPicks(
  playbook: Playbook,
  excludeIds: string[] = [],
): string[][] {
  const choose = possessionChoose(playbook)
  if (choose === 0) return [[]]
  const exclude = new Set(excludeIds)
  const ids = possessionOptions(playbook)
    .filter((o) => !o.custom && !exclude.has(o.id))
    .map((o) => o.id)
  if (ids.length < choose) return combinations(
    possessionOptions(playbook).filter((o) => !o.custom).map((o) => o.id),
    choose,
  )
  return combinations(ids, choose)
}

function buildCharacter(
  playbook: Playbook,
  backgroundId: string,
  fields: Record<string, unknown>,
  movePicks: string[],
  possessionPicks: string[],
): CharacterState {
  const state = emptyCharacterState(playbook)
  state.identity.background_id = backgroundId
  fillNarrativeDefaults(playbook, state)
  assignPrintedStats(playbook, state)

  state.setup.background_fields = { ...fields }
  state.moves.selected = startingMoveIds(playbook, backgroundId, movePicks)
  state.possessions.selected = [...possessionPicks]
  applyBackgroundSelectionEffects(state, playbook)
  fillStartingMoveFields(playbook, state)

  // If free picks include improved-stat / superior-stat, assign a legal bump.
  const bumpPicks: Record<string, (string | null)[]> = {}
  const effectMoves =
    (state.setup.background_effect_grants as { moves?: string[] } | undefined)?.moves ?? []
  const free = freeChosenMoves(
    state.moves.selected,
    startingMovesPlan(playbook, backgroundId),
    effectMoves,
  )
  for (const id of free) {
    const move = playbook.moves.find((m) => m.id === id)
    if (!move || !isStatBumpMove(move)) continue
    const slots = bumpPicks[id] ?? []
    // Raise the lowest stat under the cap.
    const base = { ...(state.setup.stat_base as Record<string, number>) }
    const current = applyStatBumps(base, bumpPicks, playbook.moves)
    const cap = move.id === 'improved-stat' ? 2 : 3
    const stat = STAT_KEYS.find((s) => (current[s] ?? 0) < cap) ?? 'STR'
    slots.push(stat)
    bumpPicks[id] = slots
  }
  if (Object.keys(bumpPicks).length) {
    state.setup.stat_bump_picks = bumpPicks
    state.mechanics.stats = applyStatBumps(
      { ...(state.setup.stat_base as Record<string, number>) },
      bumpPicks,
      playbook.moves,
    )
  }

  // Possession step counts only player-chosen slots; selection_effect may add extras.
  // Wizard possessions validator checks selected.length === choose, but
  // applyBackgroundSelectionEffects can push above choose. Mirror Wizard:
  // keep effect grants; for validation we temporarily check after effects.
  // If over-choose due to effects, trim is NOT done by wizard — note as gap if fail.

  state.inserts = attachAutoInserts(state, playbook, pack.content.inserts)
  state.mechanics.trackers = syncTrackers(state, playbook)
  return state
}

function contentIntegrity(playbook: Playbook): Issue[] {
  const issues: Issue[] = []
  const moveIds = new Set(playbook.moves.map((m) => m.id))
  const possIds = new Set(possessionOptions(playbook).map((o) => o.id))
  const insertIds = new Set(pack.content.inserts.map((i) => i.id))

  for (const id of playbook.starting_move_rules.fixed ?? []) {
    if (!moveIds.has(id))
      issues.push({
        severity: 'error',
        playbook: playbook.id,
        path: 'starting_move_rules.fixed',
        message: `fixed move missing: ${id}`,
      })
  }
  for (const g of playbook.starting_move_rules.choice_groups ?? []) {
    for (const id of g.options) {
      if (!moveIds.has(id))
        issues.push({
          severity: 'error',
          playbook: playbook.id,
          path: 'starting_move_rules.choice_groups',
          message: `pick-one option missing: ${id}`,
        })
    }
  }
  for (const bg of playbook.backgrounds) {
    for (const g of bg.grants ?? []) {
      if (g.type === 'move' && !moveIds.has(g.id)) {
        issues.push({
          severity: 'error',
          playbook: playbook.id,
          background: bg.id,
          path: 'grants.move',
          message: `background move grant missing: ${g.id}`,
        })
      }
      if (g.type === 'insert' && !insertIds.has(g.id)) {
        issues.push({
          severity: 'error',
          playbook: playbook.id,
          background: bg.id,
          path: 'grants.insert',
          message: `background insert grant missing: ${g.id}`,
        })
      }
      if (g.type === 'possession' && !possIds.has(g.id)) {
        issues.push({
          severity: 'warn',
          playbook: playbook.id,
          background: bg.id,
          path: 'grants.possession',
          message: `possession grant id not in special_possessions.options: ${g.id}`,
        })
      }
    }
    for (const f of bg.creation_fields ?? []) {
      for (const id of optionIds(f)) {
        // selection_effect options are moves or possessions
        if (!moveIds.has(id) && !possIds.has(id) && f.status !== 'pending_external_trait_catalog') {
          // Some options are narrative labels (titles, topics) — only warn
          if (
            f.type === 'single_choice' ||
            f.type === 'single_choice_reference' ||
            f.type === 'multi_choice'
          ) {
            const looksLikeContentId = /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(id)
            if (looksLikeContentId) {
              issues.push({
                severity: 'warn',
                playbook: playbook.id,
                background: bg.id,
                path: `creation_fields.${f.key}`,
                message: `option id not a move or possession: ${id}`,
              })
            }
          }
        }
      }
    }
  }
  for (const m of playbook.moves) {
    for (const r of m.requires ?? []) {
      const reqId = r.includes(':') ? r.split(':')[0]! : r
      if (moveIds.has(reqId)) continue
      // Non-move expressions the pack uses but the engine does not evaluate.
      const looksStat = /^[A-Z]{3}\s*[><=]/.test(r)
      const looksOr = /\sOR\s/i.test(r)
      issues.push({
        severity: 'warn',
        playbook: playbook.id,
        path: `moves.${m.id}.requires`,
        message: looksStat || looksOr || r.includes('>=')
          ? `engine cannot evaluate require expression "${r}" (only move ids and moveId:full trackers)`
          : `requires unknown move: ${r}`,
      })
    }
    if (m.replaces && !moveIds.has(m.replaces)) {
      issues.push({
        severity: 'error',
        playbook: playbook.id,
        path: `moves.${m.id}.replaces`,
        message: `replaces unknown move: ${m.replaces}`,
      })
    }
  }
  return issues
}

function grantGapsFor(playbook: Playbook, bg: Background): Issue[] {
  const issues: Issue[] = []
  const handled = new Set(['move', 'insert', 'selection_effect', 'well_versed_topic'])
  for (const g of bg.grants ?? []) {
    if (!handled.has(g.type)) {
      issues.push({
        severity: 'warn',
        playbook: playbook.id,
        background: bg.id,
        path: 'grants',
        message: `grant type "${g.type}" id="${g.id}" is not auto-applied by creation engine (only move/insert/selection_effect/well_versed_topic are)`,
      })
    }
  }
  return issues
}

function pickStatForBump(state: CharacterState, moveId: string): StatKey | null {
  const cap = moveId === 'improved-stat' ? 2 : 3
  return STAT_KEYS.find((s) => (state.mechanics.stats[s] ?? 0) < cap) ?? null
}

function tryApply(
  playbook: Playbook,
  state: CharacterState,
  moveId: string,
): { ok: true; state: CharacterState } | { ok: false; error: string } {
  const funded = structuredClone(state)
  funded.mechanics.xp = Math.max(funded.mechanics.xp, xpForNextLevel(funded.mechanics.level))
  const move = playbook.moves.find((m) => m.id === moveId)
  const choice: { moveId: string; stat?: StatKey } = { moveId }
  if (move && isStatBumpMove(move)) {
    const stat = pickStatForBump(funded, moveId)
    if (!stat) return { ok: false, error: 'no stat under bump cap' }
    choice.stat = stat
  }
  return applyLevelUp(funded, playbook, choice)
}

/**
 * Advancement coverage without combinatorial explosion:
 * 1. At each level on a single spine, fork-test every currently legal pick once.
 * 2. Walk a greedy spine (prefer unlocking unmet requires) up to maxLevel.
 * 3. Report advancement-eligible moves never successfully applied.
 */
function advancementReachability(playbook: Playbook, base: CharacterState, maxLevel = 10) {
  const reachable = new Set<string>()
  const failed: Issue[] = []
  let tried = 0
  let ok = 0
  let statesExplored = 0

  let spine = structuredClone(base)

  while (spine.mechanics.level < maxLevel) {
    statesExplored++
    const funded = structuredClone(spine)
    funded.mechanics.xp = Math.max(funded.mechanics.xp, xpForNextLevel(funded.mechanics.level))
    if (!canLevelUp(funded)) break

    const legal = legalLevelUpMoves(funded, playbook)
    // Fork-test every legal option from this spine state
    for (const opt of legal) {
      tried++
      const result = tryApply(playbook, spine, opt.move.id)
      if (!result.ok) {
        failed.push({
          severity: 'error',
          playbook: playbook.id,
          path: `advancement/L${spine.mechanics.level + 1}/${opt.move.id}`,
          message: result.error,
        })
        continue
      }
      ok++
      reachable.add(opt.move.id)
    }

    if (!legal.length) break

    // Advance spine: prefer a not-yet-reached move, else first legal
    const prefer =
      legal.find((o) => !reachable.has(o.move.id)) ??
      legal.find((o) => (o.move.requires ?? []).length > 0) ??
      legal[0]!
    const advanced = tryApply(playbook, spine, prefer.move.id)
    if (!advanced.ok) break
    spine = advanced.state
    reachable.add(prefer.move.id)
  }

  // Second pass: from fresh baseline, try dedicated short paths for gated moves
  for (const m of playbook.moves) {
    if (reachable.has(m.id)) continue
    const min = m.min_level ?? 1
    if (min <= 1 && !isStatBumpMove(m) && !m.repeatable) continue
    if (min > maxLevel) continue

    let cur = structuredClone(base)
    // Take requirement moves first when possible
    for (const req of m.requires ?? []) {
      const reqId = req.includes(':') ? req.split(':')[0]! : req
      // Tracker-gated: fill marks whenever a :suffix require is present
      if (req.includes(':') && cur.mechanics.trackers[reqId]) {
        const t = cur.mechanics.trackers[reqId] as { boxes: number; marked: number }
        t.marked = t.boxes
      }
      if (heldMoveIds(cur, playbook).includes(reqId)) continue
      // Level up until we can take reqId or hit cap
      let guard = 0
      while (
        !heldMoveIds(cur, playbook).includes(reqId) &&
        cur.mechanics.level < maxLevel &&
        guard++ < 12
      ) {
        const funded = structuredClone(cur)
        funded.mechanics.xp = Math.max(funded.mechanics.xp, xpForNextLevel(funded.mechanics.level))
        const legal = legalLevelUpMoves(funded, playbook)
        const hit = legal.find((o) => o.move.id === reqId)
        const pick = hit ?? legal[0]
        if (!pick) break
        const r = tryApply(playbook, cur, pick.move.id)
        if (!r.ok) break
        cur = r.state
        reachable.add(pick.move.id)
        if (req.includes(':') && cur.mechanics.trackers[reqId]) {
          const t = cur.mechanics.trackers[reqId] as { boxes: number; marked: number }
          t.marked = t.boxes
        }
      }
    }

    // Level up until min_level and try the move
    let guard = 0
    while (cur.mechanics.level + 1 < min && cur.mechanics.level < maxLevel && guard++ < 12) {
      const funded = structuredClone(cur)
      funded.mechanics.xp = xpForNextLevel(funded.mechanics.level)
      const legal = legalLevelUpMoves(funded, playbook)
      const pick = legal[0]
      if (!pick) break
      const r = tryApply(playbook, cur, pick.move.id)
      if (!r.ok) break
      cur = r.state
    }

    if (cur.mechanics.level + 1 >= min && cur.mechanics.level < maxLevel) {
      tried++
      const r = tryApply(playbook, cur, m.id)
      if (r.ok) {
        ok++
        reachable.add(m.id)
      }
    }
  }

  const unreachable: { playbook: string; moveId: string; name: string; reason: string }[] = []
  const heldAtCreation = new Set(heldMoveIds(base, playbook))
  for (const m of playbook.moves) {
    const min = m.min_level ?? 1
    // Skip pure creation-only one-shots (and already-held starting grants)
    if (min <= 1 && !isStatBumpMove(m) && !m.repeatable && (m.boxes ?? 0) <= 1) continue
    if (heldAtCreation.has(m.id) && !m.repeatable && !isStatBumpMove(m)) continue
    if (reachable.has(m.id)) continue
    if (min > maxLevel) {
      unreachable.push({
        playbook: playbook.id,
        moveId: m.id,
        name: m.name,
        reason: `min_level ${min} > sim cap ${maxLevel}`,
      })
      continue
    }
    unreachable.push({
      playbook: playbook.id,
      moveId: m.id,
      name: m.name,
      reason:
        (m.requires ?? []).length > 0
          ? `not applied in sim (requires: ${(m.requires ?? []).join(', ')})`
          : 'not applied in sim within level cap',
    })
  }

  return { tried, ok, failed, reachable, unreachable, statesExplored }
}

describe('creation + advancement simulation (live pack)', () => {
  it('supports all mechanical creation combos and reports gaps', () => {
    const report: SimReport = {
      packVersion: pack._meta?.version,
      createdOk: 0,
      createdFail: 0,
      bookCorrectOk: 0,
      bookCorrectFail: 0,
      engineUndercountsExtras: 0,
      narrativeOk: 0,
      narrativeFail: 0,
      advancementTried: 0,
      advancementOk: 0,
      advancementFail: 0,
      unreachableAdvancements: [],
      contentIssues: [],
      creationFailures: [],
      advancementFailures: [],
      grantGaps: [],
      counts: {},
    }

    expect(pack.content.playbooks).toHaveLength(9)

    const perPlaybook: Record<string, unknown> = {}

    for (const playbook of pack.content.playbooks) {
      report.contentIssues.push(...contentIntegrity(playbook))

      // Narrative coverage: every instinct / origin / appearance option selectable
      for (const instinct of playbook.instincts) {
        const state = emptyCharacterState(playbook)
        state.identity.background_id = playbook.backgrounds[0]!.id
        fillNarrativeDefaults(playbook, state)
        assignPrintedStats(playbook, state)
        state.identity.instinct_id = instinct.id
        if (instinct.custom) state.identity.instinct_write_in = 'custom instinct'
        else delete state.identity.instinct_write_in
        // minimal moves/poss so readyToFinish isn't blocked by those when testing instinct alone
        const movePicks = enumerateMovePicks(playbook, playbook.backgrounds[0]!.id)[0] ?? []
        const possPicks = enumeratePossessionPicks(playbook)[0] ?? []
        state.moves.selected = startingMoveIds(playbook, playbook.backgrounds[0]!.id, movePicks)
        state.possessions.selected = [...possPicks]
        applyBackgroundSelectionEffects(state, playbook)
        if (stepValid('instinct', playbook, state)) report.narrativeOk++
        else {
          report.narrativeFail++
          report.creationFailures.push({
            severity: 'error',
            playbook: playbook.id,
            path: `instinct.${instinct.id}`,
            message: 'instinct step invalid',
          })
        }
      }
      for (const origin of playbook.origins) {
        const state = emptyCharacterState(playbook)
        state.identity.background_id = playbook.backgrounds[0]!.id
        fillNarrativeDefaults(playbook, state)
        state.identity.origin_id = origin.id
        state.identity.character_name = 'Sim'
        if (stepValid('origin', playbook, state)) report.narrativeOk++
        else {
          report.narrativeFail++
          report.creationFailures.push({
            severity: 'error',
            playbook: playbook.id,
            path: `origin.${origin.id}`,
            message: 'origin step invalid',
          })
        }
      }
      for (const group of playbook.appearance_groups) {
        for (const opt of group.options) {
          const state = emptyCharacterState(playbook)
          fillNarrativeDefaults(playbook, state)
          state.identity.appearance[group.id] = opt.id
          // fill other groups
          for (const g of playbook.appearance_groups) {
            if (!state.identity.appearance[g.id]) state.identity.appearance[g.id] = g.options[0]!.id
          }
          if (stepValid('appearance', playbook, state)) report.narrativeOk++
          else {
            report.narrativeFail++
            report.creationFailures.push({
              severity: 'error',
              playbook: playbook.id,
              path: `appearance.${group.id}.${opt.id}`,
              message: 'appearance step invalid',
            })
          }
        }
      }

      let pbCreated = 0
      let pbFailed = 0
      let pbBookOk = 0
      let pbBookFail = 0
      let pbEngineUndercount = 0
      let sampleReady: CharacterState | null = null

      for (const bg of playbook.backgrounds) {
        report.grantGaps.push(...grantGapsFor(playbook, bg))
        const fieldSets = enumerateFieldAssignments(bg.creation_fields)

        for (const fields of fieldSets) {
          const effectPossIds: string[] = []
          for (const g of bg.grants ?? []) {
            if (g.type !== 'selection_effect') continue
            const from = (g as { from?: string }).from
            if (!from) continue
            const val = fields[from]
            const picks = Array.isArray(val)
              ? val.map(String)
              : typeof val === 'string' && val
                ? [val]
                : []
            for (const id of picks) {
              if (possessionOptions(playbook).some((o) => o.id === id)) effectPossIds.push(id)
            }
          }
          const moveSets = enumerateMovePicks(playbook, bg.id, fields)
          const possSets = enumeratePossessionPicks(playbook, effectPossIds)
          for (const moves of moveSets) {
            for (const poss of possSets) {
              try {
                const state = buildCharacter(playbook, bg.id, fields, moves, poss)
                const engineReady = readyToFinish(playbook, state)
                const bookReady = readyToFinishBookCorrect(playbook, state)

                if (bookReady) {
                  pbBookOk++
                  report.bookCorrectOk++
                } else {
                  pbBookFail++
                  report.bookCorrectFail++
                }

                if (engineReady) {
                  state.creation_complete = true
                  pbCreated++
                  report.createdOk++
                  if (!sampleReady) sampleReady = state
                } else {
                  pbFailed++
                  report.createdFail++
                  if (bookReady) {
                    pbEngineUndercount++
                    report.engineUndercountsExtras++
                  }
                  if (report.creationFailures.length < 40) {
                    const failedSteps = (
                      [
                        'background',
                        'instinct',
                        'appearance',
                        'origin',
                        'stats',
                        'moves',
                        'possessions',
                      ] as const
                    ).filter((id) => !stepValid(id, playbook, state))
                    report.creationFailures.push({
                      severity: bookReady ? 'warn' : 'error',
                      playbook: playbook.id,
                      background: bg.id,
                      path: `create/moves=${moves.join('+')}/poss=${poss.join('+')}`,
                      message: `engineReady=${engineReady} bookReady=${bookReady}; failed steps: ${failedSteps.join(',')}; possCount=${state.possessions.selected.length} playerPoss=${playerPossessionCount(state)} freeExtra=${playerExtraMoveCount(playbook, state)}`,
                    })
                  }
                  // Still usable as advancement baseline if book-correct
                  if (!sampleReady && bookReady) {
                    state.creation_complete = true
                    sampleReady = state
                  }
                }
              } catch (e) {
                pbFailed++
                report.createdFail++
                report.bookCorrectFail++
                pbBookFail++
                report.creationFailures.push({
                  severity: 'error',
                  playbook: playbook.id,
                  background: bg.id,
                  path: 'create/throw',
                  message: e instanceof Error ? e.message : String(e),
                })
              }
            }
          }
        }
      }

      // Advancements from one successful baseline
      let adv = {
        tried: 0,
        ok: 0,
        failed: [] as Issue[],
        unreachable: [] as { playbook: string; moveId: string; name: string; reason: string }[],
        statesExplored: 0,
      }
      if (sampleReady) {
        adv = advancementReachability(playbook, sampleReady, 10)
        report.advancementTried += adv.tried
        report.advancementOk += adv.ok
        report.advancementFail += adv.failed.length
        report.advancementFailures.push(...adv.failed)
        report.unreachableAdvancements.push(...adv.unreachable)
      } else {
        report.advancementFailures.push({
          severity: 'error',
          playbook: playbook.id,
          path: 'advancement',
          message: 'no successful creation baseline to advance from',
        })
      }

      perPlaybook[playbook.id] = {
        createdOk: pbCreated,
        createdFail: pbFailed,
        bookCorrectOk: pbBookOk,
        bookCorrectFail: pbBookFail,
        engineUndercountsExtras: pbEngineUndercount,
        advancementTried: adv.tried,
        advancementOk: adv.ok,
        unreachable: adv.unreachable.map((u) => u.moveId),
        statesExplored: adv.statesExplored,
      }
    }

    report.counts = {
      playbooks: pack.content.playbooks.length,
      backgrounds: pack.content.playbooks.reduce((a, p) => a + p.backgrounds.length, 0),
      perPlaybook,
      pending_verification: pack.pending_verification ?? [],
    }

    const outPath = resolve(__dirname, '../../../../scripts/_creation-sim-report.json')
    writeFileSync(outPath, JSON.stringify(report, null, 2))

    // Soft assertions: report is the deliverable.
    const contentErrors = report.contentIssues.filter((i) => i.severity === 'error')
    expect(contentErrors, JSON.stringify(contentErrors, null, 2)).toEqual([])
    expect(report.narrativeFail).toBe(0)
    expect(report.advancementFail, `advancement apply failures: ${report.advancementFail}`).toBe(0)

    console.log(
      JSON.stringify(
        {
          createdOk: report.createdOk,
          createdFail: report.createdFail,
          bookCorrectOk: report.bookCorrectOk,
          bookCorrectFail: report.bookCorrectFail,
          engineUndercountsExtras: report.engineUndercountsExtras,
          grantGaps: report.grantGaps.length,
          unreachableAdv: report.unreachableAdvancements,
          report: outPath,
        },
        null,
        2,
      ),
    )
  }, 180_000)
})
