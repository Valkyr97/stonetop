import { describe, expect, it } from 'vitest'
import { emptyCharacterState } from '../../content/types'
import { heldMoveIds, statBumpCap } from './moves'
import { makeTestPlaybook } from './test-fixtures'

describe('heldMoveIds', () => {
  it('starts with fixed + background-granted + creation extras', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.moves.selected = ['fixed-move', 'granted-move', 'basic-move']
    expect(heldMoveIds(state, pb).sort()).toEqual(['basic-move', 'fixed-move', 'granted-move'])
  })

  it('drops the first occurrence of a replaced move', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.moves.selected = ['fixed-move', 'basic-move']
    state.mechanics.advancement = [{ level: 3, moveId: 'upgrade-move', replaced: 'basic-move' }]
    const held = heldMoveIds(state, pb)
    expect(held).toContain('upgrade-move')
    expect(held).not.toContain('basic-move')
  })
})

describe('statBumpCap', () => {
  it('caps Improved Stat at +2 and Superior Stat at +3', () => {
    const pb = makeTestPlaybook()
    expect(statBumpCap(pb.moves.find((m) => m.id === 'improved-stat')!)).toBe(2)
  })

  it('returns null for a normal move', () => {
    const pb = makeTestPlaybook()
    expect(statBumpCap(pb.moves.find((m) => m.id === 'basic-move')!)).toBeNull()
  })
})
