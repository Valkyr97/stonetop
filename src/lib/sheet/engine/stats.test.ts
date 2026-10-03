import { describe, expect, it } from 'vitest'
import {
  assignedStatValues,
  isStatArrayComplete,
  remainingStatValues,
  type StatAssignments,
} from './stats'

const ARRAY = [2, 1, 1, 0, 0, -1]

describe('remainingStatValues', () => {
  it('removes values held by other stats, keeping duplicates correct', () => {
    const a: StatAssignments = { STR: 2, DEX: 1 }
    expect(remainingStatValues(ARRAY, a).sort((x, y) => x - y)).toEqual([-1, 0, 0, 1])
  })

  it("keeps a stat's own value available via `except`", () => {
    const a: StatAssignments = { STR: 2 }
    expect(remainingStatValues(ARRAY, a, 'STR')).toContain(2)
    expect(remainingStatValues(ARRAY, a)).not.toContain(2)
  })
})

describe('isStatArrayComplete', () => {
  it('is false until all six are assigned', () => {
    expect(isStatArrayComplete(ARRAY, { STR: 2 })).toBe(false)
  })

  it('is true for a valid permutation of the array', () => {
    const a: StatAssignments = {
      STR: 2,
      DEX: 1,
      CON: 1,
      INT: 0,
      WIS: 0,
      CHA: -1,
    }
    expect(isStatArrayComplete(ARRAY, a)).toBe(true)
    expect(assignedStatValues(a).sort((x, y) => x - y)).toEqual([...ARRAY].sort((x, y) => x - y))
  })

  it('is false if a value not in the array is used', () => {
    const a: StatAssignments = {
      STR: 2,
      DEX: 1,
      CON: 1,
      INT: 0,
      WIS: 0,
      CHA: 3,
    }
    expect(isStatArrayComplete(ARRAY, a)).toBe(false)
  })
})
