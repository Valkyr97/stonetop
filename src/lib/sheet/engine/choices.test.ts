import { describe, expect, it } from 'vitest'
import { canPickMore, isSelectionValid, selectionCount, toggleOption } from './choices'
import { applyBackgroundSelectionEffects } from '../wizard/backgroundEffects'
import { emptyCharacterState, type Playbook } from '../../content/types'

describe('choices', () => {
  const choice = { min: 2, max: 3 }

  it('counts write-in as a pick', () => {
    expect(selectionCount({ selected: ['a'], writeIn: 'x' })).toBe(2)
    expect(selectionCount({ selected: ['a'], writeIn: '  ' })).toBe(1)
  })

  it('validates min/max', () => {
    expect(isSelectionValid(choice, { selected: ['a'] })).toBe(false)
    expect(isSelectionValid(choice, { selected: ['a', 'b'] })).toBe(true)
    expect(isSelectionValid(choice, { selected: ['a', 'b', 'c', 'd'] })).toBe(false)
  })

  it('toggles without exceeding max', () => {
    let sel = toggleOption(choice, undefined, 'a')
    sel = toggleOption(choice, sel, 'b')
    sel = toggleOption(choice, sel, 'c')
    const blocked = toggleOption(choice, sel, 'd')
    expect(blocked.selected).toEqual(['a', 'b', 'c'])
    expect(canPickMore(choice, blocked)).toBe(false)
  })
})

describe('background selection effects', () => {
  const playbook = {
    id: 'fox',
    type: 'playbook',
    name: 'The Fox',
    base: { damage_die: 'd8', max_hp: 16, stat_array: [2, 1, 1, 0, 0, -1] },
    backgrounds: [
      {
        id: 'a-life-of-crime',
        name: 'A Life of Crime',
        creation_fields: [
          { key: 'extra_move', type: 'single_choice', options: ['burgle', 'light-fingers'] },
          { key: 'extra_possession', type: 'single_choice', options: ['burglars-kit', 'hidden-stash'] },
        ],
        grants: [
          { type: 'selection_effect', from: 'extra_move' },
          { type: 'selection_effect', from: 'extra_possession' },
        ],
      },
    ],
    instincts: [],
    appearance_groups: [],
    origins: [],
    starting_move_rules: { fixed: ['all-in-the-wrist'], free_choices: 1 },
    moves: [
      { id: 'all-in-the-wrist', name: 'All in the Wrist' },
      { id: 'burgle', name: 'Burgle' },
      { id: 'light-fingers', name: 'Light Fingers' },
    ],
    special_possessions: {
      choose: 2,
      options: [
        { id: 'burglars-kit', name: "Burglar's kit" },
        { id: 'hidden-stash', name: 'Hidden stash' },
      ],
    },
  } as unknown as Playbook

  it('grants move + possession from nested picks', () => {
    const draft = emptyCharacterState(playbook)
    draft.identity.background_id = 'a-life-of-crime'
    draft.setup.background_fields = {
      extra_move: 'burgle',
      extra_possession: 'hidden-stash',
    }
    applyBackgroundSelectionEffects(draft, playbook)
    expect(draft.moves.selected).toContain('burgle')
    expect(draft.moves.selected).toContain('all-in-the-wrist')
    expect(draft.possessions.selected).toContain('hidden-stash')
  })

  it('swaps grants when the pick changes', () => {
    const draft = emptyCharacterState(playbook)
    draft.identity.background_id = 'a-life-of-crime'
    draft.setup.background_fields = { extra_move: 'burgle', extra_possession: 'burglars-kit' }
    applyBackgroundSelectionEffects(draft, playbook)
    draft.setup.background_fields = {
      extra_move: 'light-fingers',
      extra_possession: 'hidden-stash',
    }
    applyBackgroundSelectionEffects(draft, playbook)
    expect(draft.moves.selected).toContain('light-fingers')
    expect(draft.moves.selected).not.toContain('burgle')
    expect(draft.possessions.selected).toEqual(['hidden-stash'])
  })
})
