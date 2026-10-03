import { describe, expect, it } from 'vitest'
import type { CreationField } from '../../content/types'
import {
  fieldFixedLines,
  fieldOptionIds,
  fieldPrompt,
  fieldReferenceHint,
  fieldToChoiceDef,
  isInteractiveChoice,
} from './creationFields'

describe('creationFields', () => {
  it('maps major arcanum reference options into a ChoiceGroup', () => {
    const field: CreationField = {
      key: 'major_arcanum',
      type: 'single_choice_reference',
      options: ['major-demonhide-cloak', 'major-redwood-effigy'],
    }
    const choice = fieldToChoiceDef(null, field)
    expect(choice).not.toBeNull()
    expect(choice!.prompt).toMatch(/major arcanum/i)
    expect(choice!.options.map((o) => o.value)).toEqual([
      'major-demonhide-cloak',
      'major-redwood-effigy',
    ])
    expect(choice!.options[0].label).toMatch(/Demonhide Cloak/)
  })

  it('surfaces missionary fixed neighbors even before picks', () => {
    const field: CreationField = {
      key: 'additional_neighbors',
      type: 'multi_choice',
      min: 2,
      max: 2,
      options: ['isalde', 'rahat', 'tejisha', 'unz'],
      fixed: ['devin', 'haeris'],
    }
    const choice = fieldToChoiceDef(null, field)
    expect(choice?.fixed).toEqual(['Devin', 'Haeris'])
    expect(isInteractiveChoice(field)).toBe(true)
  })

  it('lists wide-wanderer contacts when array is not interactive', () => {
    const field: CreationField = {
      key: 'neighbor_contacts',
      type: 'array',
      fixed_entities: ['ennis:marshedge', 'shahar:gordins-delve'],
    }
    expect(isInteractiveChoice(field)).toBe(false)
    expect(fieldFixedLines(field)).toEqual([
      'Ennis (Marshedge)',
      'Shahar (Gordins Delve)',
    ])
    expect(fieldPrompt(field)).toMatch(/contacts/i)
  })

  it('hints when a reference has a target but no options yet', () => {
    const field: CreationField = {
      key: 'additional_pouch_trait',
      type: 'single_choice_reference',
      target: 'sacred_pouch_traits',
    }
    expect(fieldOptionIds(field)).toEqual([])
    expect(fieldReferenceHint(field)).toMatch(/Sacred Pouch Traits/)
  })

  it('flattens destiny token option groups', () => {
    const field: CreationField = {
      key: 'destiny_tokens',
      type: 'multi_choice',
      min: 3,
      max: 4,
      option_groups: [
        ['anointed', 'marked at birth'],
        ['destroy', 'discover'],
      ],
    }
    expect(fieldOptionIds(field)).toEqual([
      'anointed',
      'marked at birth',
      'destroy',
      'discover',
    ])
    expect(fieldToChoiceDef(null, field)?.options.length).toBe(4)
  })
})
