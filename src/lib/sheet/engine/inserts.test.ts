import { describe, expect, it } from 'vitest'
import { emptyCharacterState } from '../../content/types'
import { attachAutoInserts, attachInsert, autoAttachedInsertIds, detachInsert, isInsertAttached } from './inserts'
import { TEST_INSERTS, makeTestPlaybook } from './test-fixtures'

describe('autoAttachedInsertIds', () => {
  it('always includes inventory and playbook-wide grants, never manual inserts', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    const ids = autoAttachedInsertIds(state, pb, TEST_INSERTS)
    expect(ids).toContain('inventory')
    expect(ids).toContain('auto-by-playbook')
    expect(ids).not.toContain('followers')
  })

  it('adds a move-gated insert once the move is held', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.moves.selected = ['fixed-move', 'granted-move']
    const ids = autoAttachedInsertIds(state, pb, TEST_INSERTS)
    expect(ids).toContain('auto-by-move')
  })
})

describe('attach / detach', () => {
  it('attachInsert seeds an empty blob; detachInsert removes it', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    expect(isInsertAttached(state, 'followers')).toBe(false)
    state.inserts = attachInsert(state, 'followers')
    expect(isInsertAttached(state, 'followers')).toBe(true)
    state.inserts = detachInsert(state, 'followers')
    expect(isInsertAttached(state, 'followers')).toBe(false)
  })

  it('attachAutoInserts seeds every auto-eligible insert without touching manual ones', () => {
    const pb = makeTestPlaybook()
    const state = emptyCharacterState(pb)
    state.inserts = attachAutoInserts(state, pb, TEST_INSERTS)
    expect(isInsertAttached(state, 'inventory')).toBe(true)
    expect(isInsertAttached(state, 'auto-by-playbook')).toBe(true)
    expect(isInsertAttached(state, 'followers')).toBe(false)
  })
})
