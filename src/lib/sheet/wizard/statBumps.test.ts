import { describe, expect, it } from 'vitest'
import { makeTestPlaybook } from '../engine/test-fixtures'
import { applyStatBumps, remainingBumpsForStat } from './statBumps'

describe('applyStatBumps', () => {
  it('raises a stat by 1 per Improved Stat pick', () => {
    const pb = makeTestPlaybook()
    const out = applyStatBumps(
      { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
      { 'improved-stat': ['STR'] },
      pb.moves,
    )
    expect(out.STR).toBe(1)
  })

  it('will not push a stat past Improved Stat max of +2', () => {
    const pb = makeTestPlaybook()
    const out = applyStatBumps(
      { STR: 2, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
      { 'improved-stat': ['STR', 'STR'] },
      pb.moves,
    )
    expect(out.STR).toBe(2)
  })

  it('allows raising from +1 to +2 with Improved Stat', () => {
    const pb = makeTestPlaybook()
    const out = applyStatBumps(
      { STR: 1, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
      { 'improved-stat': ['STR'] },
      pb.moves,
    )
    expect(out.STR).toBe(2)
  })
})

describe('remainingBumpsForStat', () => {
  it('blocks picking a stat already at the Improved Stat cap', () => {
    const pb = makeTestPlaybook()
    const base = { STR: 2, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
    expect(remainingBumpsForStat(base, {}, pb.moves, 'improved-stat', 'STR', 2, 0)).toBe(0)
    expect(remainingBumpsForStat(base, {}, pb.moves, 'improved-stat', 'DEX', 2, 0)).toBe(1)
  })
})
