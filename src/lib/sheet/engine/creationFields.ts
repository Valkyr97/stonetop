/**
 * Shared helpers for rendering playbook/background/move creation_fields.
 * Ensures option labels and fixed lines always surface even when a field
 * type isn't a full automated picker yet.
 */
import type { CreationField, Playbook } from '../../content/types'
import type { ChoiceDef } from '../../components/ChoiceGroup.svelte'
import { backgroundOptionLabel } from '../wizard/backgroundEffects'

export function humanizeId(id: string): string {
  return id
    .replace(/^major-/, '')
    .replace(/^minor-/, '')
    .split(/[:/_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function fieldOptionIds(field: CreationField): string[] {
  if (Array.isArray(field.options) && field.options.length) {
    return field.options.map((o) => (typeof o === 'string' ? o : o.id))
  }
  if (Array.isArray(field.option_groups)) {
    return field.option_groups.flat().map(String)
  }
  return []
}

export function fieldOptionLabel(
  playbook: Playbook | null | undefined,
  field: CreationField,
  id: string,
): string {
  if (Array.isArray(field.options)) {
    const hit = field.options.find((o) => typeof o !== 'string' && o.id === id) as
      | { id: string; label?: string }
      | undefined
    if (hit && typeof hit !== 'string' && hit.label) return hit.label
  }
  if (
    field.type === 'single_choice_reference' ||
    field.type === 'content_reference' ||
    field.type === 'insert_reference'
  ) {
    return humanizeId(id)
  }
  if (playbook) return backgroundOptionLabel(playbook, id)
  return humanizeId(id)
}

export function fieldFixedLines(field: CreationField): string[] {
  const fixed = (field as { fixed?: unknown }).fixed
  if (Array.isArray(fixed)) return fixed.map((x) => humanizeId(String(x)))
  const entities = (field as { fixed_entities?: unknown }).fixed_entities
  if (Array.isArray(entities)) {
    return entities.map((x) => {
      const s = String(x)
      // "ennis:marshedge" → "Ennis (Marshedge)"
      const [name, place] = s.split(':')
      if (place) return `${humanizeId(name)} (${humanizeId(place)})`
      return humanizeId(s)
    })
  }
  return []
}

export function fieldPrompt(field: CreationField): string {
  const custom = (field as { prompt?: string }).prompt
  if (typeof custom === 'string' && custom.trim()) return custom.trim()

  if (field.key === 'major_arcanum') return "You've also acquired 1 major arcanum:"
  if (field.key === 'background_topic') return 'Well Versed in (pick 1):'
  if (field.key === 'extra_move') return 'Extra move (pick 1):'
  if (field.key === 'extra_possession') return 'Extra special possession (pick 1):'
  if (field.key === 'additional_neighbors') return 'Add these Judges to Neighbors (pick 2 more):'
  if (field.key === 'destiny_tokens') return 'Mark your destiny tokens:'
  if (field.key === 'bond_action') return 'Mark 1 bond action:'
  if (field.key === 'veteran_upgrade') return 'Veteran Crew upgrade (pick 1):'
  if (field.key === 'lightning_story') {
    return 'Describe the time you were struck by lightning and walked away unharmed:'
  }
  if (field.key === 'neighbor_contacts') return 'Friends and contacts among the neighbors:'
  if (field.key === 'starting_armor') return 'Starting armor (pick 1):'
  if (field.key === 'additional_pouch_trait') return 'Additional sacred pouch trait:'
  if (field.key === 'initiates') return 'Choose your initiates:'
  if (field.key === 'driving_event') return 'What drives you:'
  if (field.key === 'sanction') return 'Sanction'
  if (field.key === 'enigma') return 'Enigma'
  if (field.key === 'circle') return 'Background circle'
  if (field.key === 'omens') return 'Omens'

  const isSingle =
    field.type === 'single_choice' ||
    field.type === 'single_choice_reference' ||
    field.type === 'single_choice_with_custom'
  if (isSingle) return 'Choose 1'
  if (field.type === 'multi_choice' || field.type === 'multi_choice_with_custom') {
    const min = field.min ?? 1
    const max = field.max ?? min
    return `Choose ${min}${max !== min ? `–${max}` : ''}`
  }
  return field.key.replace(/_/g, ' ')
}

export function isInteractiveChoice(field: CreationField): boolean {
  const ids = fieldOptionIds(field)
  return (
    (field.type === 'single_choice' ||
      field.type === 'single_choice_reference' ||
      field.type === 'single_choice_with_custom' ||
      field.type === 'multi_choice' ||
      field.type === 'multi_choice_with_custom') &&
    ids.length > 0
  )
}

/** Build a ChoiceGroup def when the field has concrete options. */
export function fieldToChoiceDef(
  playbook: Playbook | null | undefined,
  field: CreationField,
): ChoiceDef | null {
  if (!isInteractiveChoice(field)) return null
  const ids = fieldOptionIds(field)
  const isSingle =
    field.type === 'single_choice' ||
    field.type === 'single_choice_reference' ||
    field.type === 'single_choice_with_custom'
  const max = isSingle ? 1 : (field.max ?? field.min ?? 1)
  const min = isSingle ? 1 : (field.min ?? 1)
  return {
    id: field.key,
    prompt: fieldPrompt(field),
    min,
    max,
    fixed: fieldFixedLines(field),
    options: ids.map((id) => ({
      label: fieldOptionLabel(playbook, field, id),
      value: id,
    })),
  }
}

/**
 * Control type for `<Field>` — keep pickers when options exist; otherwise
 * fall back to text/number so the prompt still appears.
 */
export function fieldControlType(field: CreationField): string {
  const t = field.type
  if (
    (t === 'single_choice_reference' || t === 'content_reference' || t === 'insert_reference') &&
    fieldOptionIds(field).length > 0
  ) {
    return 'single_choice'
  }
  if (t === 'single_choice_reference' || t === 'content_reference' || t === 'insert_reference') {
    return 'text'
  }
  if (
    t === 'text' ||
    t === 'number' ||
    t === 'counter' ||
    t === 'uses' ||
    t === 'checkbox' ||
    t === 'single_choice' ||
    t === 'single_choice_with_custom' ||
    t === 'multi_choice' ||
    t === 'multi_choice_with_custom' ||
    t === 'checkbox_group'
  ) {
    return t
  }
  // array / unknown — show as text write-in under a prompt; fixed lines
  // are rendered separately.
  return 'text'
}

export function fieldHasVisibleContent(field: CreationField): boolean {
  return (
    isInteractiveChoice(field) ||
    fieldFixedLines(field).length > 0 ||
    field.type === 'text' ||
    field.type === 'counter' ||
    field.type === 'uses' ||
    field.type === 'number' ||
    field.type === 'array' ||
    field.type === 'single_choice_reference' ||
    field.type === 'content_reference' ||
    field.type === 'insert_reference' ||
    !!fieldOptionIds(field).length
  )
}

/** Hint when a reference field points at a catalog we don't automate yet. */
export function fieldReferenceHint(field: CreationField): string | null {
  const target = (field as { target?: string }).target
  if (!target) return null
  if (fieldOptionIds(field).length > 0) return null
  return `Pick from ${humanizeId(target)} (write it in).`
}
