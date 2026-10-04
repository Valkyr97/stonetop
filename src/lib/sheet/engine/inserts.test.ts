import { describe, expect, it } from 'vitest'
import { emptyCharacterState } from '../../content/types'
import {
  attachAutoInserts,
  attachInsert,
  autoAttachedInsertIds,
  companionTraitPickMax,
  detachInsert,
  followerSpecialTags,
  isAnimalCompanionCreated,
  isInsertAttached,
  setFollowerTag,
  withFollowerSpecialTags,
} from './inserts'
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

describe('follower special tags', () => {
  it('toggles exceptional and group without dropping other tags', () => {
    const start = 'alert, keen-nosed'
    const withEx = setFollowerTag(start, 'exceptional', true)
    expect(followerSpecialTags(withEx)).toEqual(['exceptional'])
    expect(withFollowerSpecialTags('alert, keen-nosed', ['exceptional', 'group'])).toBe(
      'alert, keen-nosed, exceptional, group',
    )
    expect(setFollowerTag(withEx, 'exceptional', false)).toBe('alert, keen-nosed')
  })
})

describe('companionTraitPickMax', () => {
  it('adds two options per Magnificent Specimen take', () => {
    expect(companionTraitPickMax(4, 0)).toBe(4)
    expect(companionTraitPickMax(4, 1)).toBe(6)
    expect(companionTraitPickMax(3, 2)).toBe(7)
  })
})

describe('isAnimalCompanionCreated', () => {
  it('is false for an empty insert blob', () => {
    expect(isAnimalCompanionCreated({})).toBe(false)
    expect(isAnimalCompanionCreated({ loyalty: 0 })).toBe(false)
  })

  it('is true once a name or type is saved', () => {
    expect(isAnimalCompanionCreated({ name: 'Ash' })).toBe(true)
    expect(isAnimalCompanionCreated({ type_id: 'bird' })).toBe(true)
  })
})
