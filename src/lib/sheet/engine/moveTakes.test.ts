import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { emptyCharacterState, type MoveDef } from '../../content/types'
import { moveRepeatCap } from '../sections'
import { heldCounts, markTakeEdit, protectedTakeCount, setCreationTakes } from './moveTakes'
import { heldCountForMove, uniqueHeldMoves } from './moves'
import { sortMovesForCatalog } from '../moves/sortMovesForCatalog'
import { makeTestPlaybook } from './test-fixtures'

describe('moveRepeatCap', () => {
  it('treats “each additional time you take this move” as repeatable', () => {
    expect(
      moveRepeatCap({
        rule_text: 'Mark 1 topic. Each additional time you take this move, mark 2 more topics.',
      }),
    ).toBeGreaterThan(1)
  })

  it('Magnificent Specimen is two takes', () => {
    const pack = JSON.parse(readFileSync('content/packs/creation-v0.1.json', 'utf8'))
    const ranger = pack.content.playbooks.find((p: { id: string }) => p.id === 'ranger')
    const move = ranger.moves.find((m: { id: string }) => m.id === 'magnificent-specimen')
    expect(moveRepeatCap(move)).toBe(2)
  })

  it('pack take caps match splatbook maxTakes', () => {
    const pack = JSON.parse(readFileSync('content/packs/creation-v0.1.json', 'utf8'))
    const splatDir = '../splatbook/content/stonetop/data'
    const files = readdirSync(splatDir).filter(
      (f) => f.startsWith('the-') && f.endsWith('.json') && f !== 'the-steading.json',
    )
    const mismatches: string[] = []
    for (const f of files) {
      const data = JSON.parse(readFileSync(join(splatDir, f), 'utf8'))
      const pbId = f.replace(/^the-/, '').replace(/\.json$/, '')
      const packPb = pack.content.playbooks.find((p: { id: string }) => p.id === pbId)
      if (!packPb) continue
      for (const m of data.moves?.list ?? []) {
        if (m.maxTakes == null) continue
        const pm = packPb.moves.find((x: { id: string }) => x.id === m.id)
        const cap = pm ? moveRepeatCap(pm) : null
        if (cap !== m.maxTakes) {
          mismatches.push(`${pbId}:${m.id} splat ${m.maxTakes} pack ${cap}`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })
})

describe('sortMovesForCatalog', () => {
  it('orders by min_level then nests same-level requires', () => {
    const moves: MoveDef[] = [
      { id: 'high', name: 'High', min_level: 6, requires: [], replaces: null },
      { id: 'polyglot', name: 'Polyglot', min_level: 1, requires: [], replaces: null },
      {
        id: 'cryptologist',
        name: 'Cryptologist',
        min_level: 1,
        requires: ['polyglot'],
        replaces: null,
      },
      { id: 'mid', name: 'Mid', min_level: 2, requires: [], replaces: null },
    ]
    const rows = sortMovesForCatalog(moves)
    expect(rows.map((r) => r.move.id)).toEqual(['polyglot', 'cryptologist', 'mid', 'high'])
    expect(rows.find((r) => r.move.id === 'cryptologist')?.depth).toBe(1)
    expect(rows.find((r) => r.move.id === 'polyglot')?.depth).toBe(0)
  })

  it('nests same-level replaces under the substituted move', () => {
    const moves: MoveDef[] = [
      { id: 'basic', name: 'Basic', min_level: 1, requires: [], replaces: null },
      {
        id: 'upgrade',
        name: 'Upgrade',
        min_level: 1,
        requires: [],
        replaces: 'basic',
      },
    ]
    const rows = sortMovesForCatalog(moves)
    expect(rows.map((r) => r.move.id)).toEqual(['basic', 'upgrade'])
    expect(rows.find((r) => r.move.id === 'upgrade')?.depth).toBe(1)
  })
})

describe('heldCounts / uniqueHeldMoves', () => {
  it('counts retakes once for display helpers', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.moves.selected = ['fixed-move', 'basic-move']
    state.mechanics.advancement = [{ level: 2, moveId: 'basic-move' }]
    expect(heldCountForMove(state, pb, 'basic-move')).toBe(2)
    expect(heldCounts(state, pb).get('basic-move')).toBe(2)
    expect(uniqueHeldMoves(state, pb).filter((m) => m.id === 'basic-move')).toHaveLength(1)
  })
})

describe('setCreationTakes / markTakeEdit', () => {
  it('protects granted takes from unmarking', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.identity.background_id = 'bg-a'
    state.moves.selected = ['fixed-move', 'granted-move']
    expect(protectedTakeCount(pb, state, 'fixed-move')).toBe(1)
    const bad = setCreationTakes(state, pb, 'fixed-move', 0)
    expect(bad.ok).toBe(false)
  })

  it('adds edit takes only via advancement (no selected clone)', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.creation_complete = true
    state.moves.selected = ['fixed-move', 'granted-move', 'basic-move']
    const result = markTakeEdit(state, pb, 'tracked-move')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.moves.selected).toEqual(['fixed-move', 'granted-move', 'basic-move'])
    expect(result.state.mechanics.advancement.map((e) => e.moveId)).toEqual(['tracked-move'])
    expect(heldCountForMove(result.state, pb, 'tracked-move')).toBe(1)
  })

  it('caps free picks by take count so Improved Stat cannot burn two slots', () => {
    const pb = makeTestPlaybook()
    let state = emptyCharacterState(pb)
    state.identity.background_id = 'bg-a'
    state.moves.selected = ['fixed-move', 'granted-move']
    let r = setCreationTakes(state, pb, 'improved-stat', 1)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    state = r.state
    expect(heldCounts(state, pb).get('improved-stat')).toBe(1)
    r = setCreationTakes(state, pb, 'improved-stat', 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Second take exceeds free_choices:1 — must not stick.
    expect(heldCounts(r.state, pb).get('improved-stat')).toBe(1)
    expect(r.state.moves.selected.filter((id) => id === 'improved-stat')).toHaveLength(1)
  })
})
