import { describe, expect, it } from 'vitest'
import { emptyCharacterState } from '../../content/types'
import { applyLevelUp, canLevelUp, legalLevelUpMoves, xpForNextLevel } from './advancement'
import { heldMoveIds } from './moves'
import { makeTestPlaybook } from './test-fixtures'

describe('xpForNextLevel / canLevelUp', () => {
  it('costs 6 + 2*level', () => {
    expect(xpForNextLevel(1)).toBe(8)
    expect(xpForNextLevel(2)).toBe(10)
  })

  it('gates on xp', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    expect(canLevelUp(state)).toBe(false)
    state.mechanics.xp = 8
    expect(canLevelUp(state)).toBe(true)
  })
})

describe('legalLevelUpMoves', () => {
  it('offers every playbook move (emulator — no prereq / level gates)', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    const opts = legalLevelUpMoves(state, pb)
    const ids = opts.map((o) => o.move.id)
    expect(ids).toContain('basic-move')
    expect(ids).toContain('improved-stat')
    expect(ids).toContain('tracked-move')
    expect(ids).toContain('gated-by-move')
    expect(ids).toContain('gated-by-tracker')
    expect(ids).toContain('high-level-move')
    expect(opts.find((o) => o.move.id === 'basic-move')?.alreadyHeld).toBe(false)
  })

  it('marks alreadyHeld when the move is on the sheet', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.mechanics.xp = 100
    state.mechanics.level = 1
    const step1 = applyLevelUp(state, pb, { moveId: 'tracked-move' })
    expect(step1.ok).toBe(true)
    if (!step1.ok) return
    const opt = legalLevelUpMoves(step1.state, pb).find((o) => o.move.id === 'tracked-move')
    expect(opt?.alreadyHeld).toBe(true)
  })

  it('still lists a move after its repeat cap (remainingTakes stays informational)', () => {
    const pb = makeTestPlaybook()
    let state = emptyCharacterState(pb)
    state.mechanics.xp = 1000
    const stats: Array<'STR' | 'DEX' | 'INT'> = ['STR', 'DEX', 'INT']
    for (const stat of stats) {
      const r = applyLevelUp(state, pb, { moveId: 'improved-stat', stat })
      expect(r.ok).toBe(true)
      if (r.ok) state = r.state
    }
    const opt = legalLevelUpMoves(state, pb).find((o) => o.move.id === 'improved-stat')
    expect(opt).toBeTruthy()
    expect(opt!.alreadyHeld).toBe(true)
    expect(opt!.remainingTakes).toBe(1)
  })
})

describe('applyLevelUp', () => {
  it('spends xp, raises level, and records the pick', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.mechanics.xp = 10
    const result = applyLevelUp(state, pb, { moveId: 'basic-move' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.mechanics.xp).toBe(2) // 10 - 8
    expect(result.state.mechanics.level).toBe(2)
    expect(result.state.mechanics.advancement).toEqual([{ level: 2, moveId: 'basic-move', stat: undefined, replaced: null }])
  })

  it('rejects a stat-bump move without a stat choice', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.mechanics.xp = 10
    const result = applyLevelUp(state, pb, { moveId: 'improved-stat' })
    expect(result.ok).toBe(false)
  })

  it('applies the stat bump and enforces its cap', () => {
    const pb = makeTestPlaybook()
    let state = emptyCharacterState(pb)
    state.mechanics.xp = 1000
    for (let i = 0; i < 2; i++) {
      const r = applyLevelUp(state, pb, { moveId: 'improved-stat', stat: 'STR' })
      expect(r.ok).toBe(true)
      if (r.ok) state = r.state
    }
    expect(state.mechanics.stats.STR).toBe(2)
    // third pick would push past the +2 cap for Improved Stat
    const r3 = applyLevelUp(state, pb, { moveId: 'improved-stat', stat: 'STR' })
    expect(r3.ok).toBe(false)
  })

  it('drops a replaced move from held moves', () => {
    const pb = makeTestPlaybook()
    let state = emptyCharacterState(pb)
    state.mechanics.xp = 1000
    // basic-move is a free level-1 pick in this fixture's starting_move_rules
    state.moves.selected = ['fixed-move', 'granted-move', 'basic-move']
    state.mechanics.level = 2 // so upgrade-move (min_level 3) is reachable next
    const r = applyLevelUp(state, pb, { moveId: 'upgrade-move' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(heldMoveIds(r.state, pb)).not.toContain('basic-move')
    expect(heldMoveIds(r.state, pb)).toContain('upgrade-move')
  })

  it('records the pick only in advancement (not duplicated into selected)', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.moves.selected = ['fixed-move', 'granted-move']
    state.mechanics.xp = 10
    const result = applyLevelUp(state, pb, { moveId: 'basic-move' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.moves.selected).toEqual(['fixed-move', 'granted-move'])
    expect(result.state.mechanics.advancement.map((e) => e.moveId)).toEqual(['basic-move'])
    expect(heldMoveIds(result.state, pb).filter((id) => id === 'basic-move')).toHaveLength(1)
  })

  it('rejects when not enough xp', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.mechanics.xp = 0
    const result = applyLevelUp(state, pb, { moveId: 'basic-move' })
    expect(result.ok).toBe(false)
  })
})
