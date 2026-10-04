import type { CharacterState } from '../content/types'

export type SheetMutator = (draft: CharacterState) => void
export type PatchSheet = (mutator: SheetMutator) => void

/** Clone a character sheet, including Svelte 5 $state proxies. */
export function cloneSheet(sheet: CharacterState): CharacterState {
  return JSON.parse(JSON.stringify(sheet)) as CharacterState
}
