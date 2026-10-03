/**
 * Nested "choose N" picks — shared by backgrounds, possessions, and extras.
 * Mirrors Splatbook `engine/choices.ts`.
 */

export interface ChoiceSelection {
  selected: string[]
  writeIn?: string
}

export interface ChoiceLike {
  min: number
  max: number
}

/** Total picks: toggled options plus a non-empty write-in. */
export function selectionCount(selection: ChoiceSelection | undefined): number {
  if (!selection) return 0
  const writeIn = selection.writeIn?.trim() ? 1 : 0
  return selection.selected.length + writeIn
}

export function isSelectionValid(
  choice: ChoiceLike,
  selection: ChoiceSelection | undefined,
): boolean {
  const n = selectionCount(selection)
  return n >= choice.min && n <= choice.max
}

export function canPickMore(choice: ChoiceLike, selection: ChoiceSelection | undefined): boolean {
  return selectionCount(selection) < choice.max
}

/** Toggle an option label; adding past max is a no-op. */
export function toggleOption(
  choice: ChoiceLike,
  selection: ChoiceSelection | undefined,
  label: string,
): ChoiceSelection {
  const current = selection ?? { selected: [] }
  if (current.selected.includes(label)) {
    return { ...current, selected: current.selected.filter((l) => l !== label) }
  }
  if (!canPickMore(choice, current)) return current
  return { ...current, selected: [...current.selected, label] }
}
