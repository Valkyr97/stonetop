import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { emptyCharacterState } from '../../content/types'
import { stepValid } from './steps'
import { replaceBackgroundMoves, startingMoveIds } from '../sections'
import { setCreationTakes } from '../engine/moveTakes'
import { applyBackgroundSelectionEffects } from './backgroundEffects'
import { freeChosenMoves, startingMovesPlan } from '../engine/moves'

const pack = JSON.parse(readFileSync('content/packs/creation-v0.1.json', 'utf8'))

function withSeekerTopics(state: ReturnType<typeof emptyCharacterState>) {
  state.setup.well_versed_topics = ['things-below', 'fae']
  state.setup.move_fields = {
    'well-versed': { additional_topic: 'fae' },
  }
}

describe('wizard gates', () => {
  it('seeker moves require Well Versed topic, then pass', () => {
    const playbook = pack.content.playbooks.find((p: any) => p.id === 'seeker')
    const state = emptyCharacterState(playbook)
    state.identity.background_id = 'patriot'
    state.moves.selected = startingMoveIds(playbook, 'patriot', [])
    applyBackgroundSelectionEffects(state, playbook)
    expect(stepValid('moves', playbook, state)).toBe(false)
    withSeekerTopics(state)
    expect(stepValid('moves', playbook, state)).toBe(true)
  })

  it('seeker background requires major arcanum', () => {
    const playbook = pack.content.playbooks.find((p: any) => p.id === 'seeker')
    const state = emptyCharacterState(playbook)
    state.identity.background_id = 'patriot'
    state.setup.background_fields = {}
    applyBackgroundSelectionEffects(state, playbook)
    expect(stepValid('background', playbook, state)).toBe(false)
    state.setup.background_fields = { major_arcanum: 'major-hec-tumel-codex' }
    expect(stepValid('background', playbook, state)).toBe(true)
  })

  it('appearance is optional', () => {
    const playbook = pack.content.playbooks.find((p: any) => p.id === 'seeker')
    const state = emptyCharacterState(playbook)
    expect(stepValid('appearance', playbook, state)).toBe(true)
  })

  it('fox selection effect does not consume free pick', () => {
    const playbook = pack.content.playbooks.find((p: any) => p.id === 'fox')
    const state = emptyCharacterState(playbook)
    state.identity.background_id = 'a-life-of-crime'
    state.setup.background_fields = { extra_move: 'all-in-the-wrist' }
    state.moves.selected = startingMoveIds(playbook, 'a-life-of-crime', [
      'ambush',
      'danger-sense',
      'slippery',
      'all-in-the-wrist',
    ])
    applyBackgroundSelectionEffects(state, playbook)
    const plan = startingMovesPlan(playbook, 'a-life-of-crime')
    const effects = (state.setup.background_effect_grants as { moves?: string[] }).moves ?? []
    expect(freeChosenMoves(state.moves.selected, plan, effects)).toEqual(['slippery'])
    expect(stepValid('moves', playbook, state)).toBe(true)
  })

  it('fox requires both choose-one pairs plus exactly one free pick', () => {
    const playbook = pack.content.playbooks.find((p: any) => p.id === 'fox')
    const state = emptyCharacterState(playbook)
    state.identity.background_id = 'the-natural'
    state.moves.selected = startingMoveIds(playbook, 'the-natural', ['ambush', 'catlike'])
    expect(stepValid('moves', playbook, state)).toBe(false)
    state.moves.selected = startingMoveIds(playbook, 'the-natural', [
      'ambush',
      'danger-sense',
      'catlike',
    ])
    expect(stepValid('moves', playbook, state)).toBe(true)
  })

  it('keeps another background’s signature move if the player picked it', () => {
    const playbook = pack.content.playbooks.find((p: any) => p.id === 'seeker')
    const selected = startingMoveIds(playbook, 'witch-hunter', ['lets-make-a-deal'])
    expect(selected).toEqual([
      'well-versed',
      'work-with-what-youve-got',
      'everything-bleeds',
      'lets-make-a-deal',
    ])
  })

  it('drops previous background grants when switching, not free picks', () => {
    const playbook = pack.content.playbooks.find((p: any) => p.id === 'seeker')
    const patriot = startingMoveIds(playbook, 'patriot', ['attuned'])
    expect(patriot).toContain('lets-make-a-deal')
    const switched = replaceBackgroundMoves(playbook, 'patriot', 'witch-hunter', patriot)
    expect(switched).toEqual([
      'well-versed',
      'work-with-what-youve-got',
      'everything-bleeds',
      'attuned',
    ])
  })

  it('ranger can take Animal Companion as a free pick', () => {
    const playbook = pack.content.playbooks.find((p: any) => p.id === 'ranger')
    const state = emptyCharacterState(playbook)
    state.identity.background_id = 'mighty-hunter'
    state.moves.selected = startingMoveIds(playbook, 'mighty-hunter', [])
    const result = setCreationTakes(state, playbook, 'animal-companion', 1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.moves.selected).toContain('animal-companion')
    expect(stepValid('moves', playbook, result.state)).toBe(true)
  })
})
