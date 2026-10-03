import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emptyCharacterState } from '../../content/types'
import { startingMoveIds } from '../sections'
import { applyBackgroundSelectionEffects } from '../wizard/backgroundEffects'
import {
  lockedTopicsFromBackground,
  moveTopicQuota,
  playerMarkedTopics,
  readMarkedTopics,
  syncWellVersedTopics,
  togglePlayerTopic,
  wellVersedTopicsValid,
} from './wellVersed'

const pack = JSON.parse(readFileSync('content/packs/creation-v0.1.json', 'utf8'))
const seeker = pack.content.playbooks.find((p: { id: string }) => p.id === 'seeker')

describe('wellVersed', () => {
  it('quotas follow the book (1 then +2 per retake)', () => {
    expect(moveTopicQuota(0)).toBe(0)
    expect(moveTopicQuota(1)).toBe(1)
    expect(moveTopicQuota(2)).toBe(3)
    expect(moveTopicQuota(3)).toBe(5)
  })

  it('locks Patriot Things Below from the grant', () => {
    const state = emptyCharacterState(seeker)
    state.identity.background_id = 'patriot'
    state.moves.selected = startingMoveIds(seeker, 'patriot', [])
    applyBackgroundSelectionEffects(state, seeker)
    expect(lockedTopicsFromBackground(seeker, state)).toEqual(['things-below'])
    expect(readMarkedTopics(state)).toContain('things-below')
    expect(wellVersedTopicsValid(seeker, state)).toBe(false)
  })

  it('locks Witch Hunter topic from background_topic pick', () => {
    const state = emptyCharacterState(seeker)
    state.identity.background_id = 'witch-hunter'
    state.setup.background_fields = { background_topic: 'fae', major_arcanum: 'major-twisted-spear' }
    state.moves.selected = startingMoveIds(seeker, 'witch-hunter', [])
    applyBackgroundSelectionEffects(state, seeker)
    expect(lockedTopicsFromBackground(seeker, state)).toEqual(['fae'])
  })

  it('marks player topics within quota and validates', () => {
    const state = emptyCharacterState(seeker)
    state.identity.background_id = 'patriot'
    state.moves.selected = startingMoveIds(seeker, 'patriot', [])
    applyBackgroundSelectionEffects(state, seeker)
    togglePlayerTopic(state, seeker, 'fae')
    expect(playerMarkedTopics(seeker, state)).toEqual(['fae'])
    expect(readMarkedTopics(state)).toEqual(['things-below', 'fae'])
    expect(wellVersedTopicsValid(seeker, state)).toBe(true)

    // At quota: cannot mark another
    togglePlayerTopic(state, seeker, 'makers')
    expect(playerMarkedTopics(seeker, state)).toEqual(['fae'])

    // Cannot unmark background lock
    togglePlayerTopic(state, seeker, 'things-below')
    expect(readMarkedTopics(state)).toContain('things-below')
  })

  it('expands quota when Well Versed is taken again', () => {
    const state = emptyCharacterState(seeker)
    state.identity.background_id = 'antiquarian'
    state.moves.selected = startingMoveIds(seeker, 'antiquarian', [])
    applyBackgroundSelectionEffects(state, seeker)
    togglePlayerTopic(state, seeker, 'fae')
    expect(wellVersedTopicsValid(seeker, state)).toBe(true)

    state.mechanics.advancement.push({ level: 2, moveId: 'well-versed' })
    syncWellVersedTopics(state, seeker)
    expect(moveTopicQuota(2)).toBe(3)
    expect(wellVersedTopicsValid(seeker, state)).toBe(false)
    togglePlayerTopic(state, seeker, 'things-below')
    togglePlayerTopic(state, seeker, 'primordial-powers')
    expect(playerMarkedTopics(seeker, state).length).toBe(3)
    expect(wellVersedTopicsValid(seeker, state)).toBe(true)
  })
})
