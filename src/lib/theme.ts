// Binary dark/light theme toggle. Dark is the default look for Stonetop's
// character surfaces; a light "paper" palette remains available and is
// remembered per-device via localStorage. Re-implemented for MyVersion
// (not ported from Splatbook's theme.ts).
import { writable } from 'svelte/store'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'stonetop.theme'

function readStored(): ThemeMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function apply(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

const initial: ThemeMode = readStored() ?? 'dark'

export const theme = writable<ThemeMode>(initial)

theme.subscribe((mode) => {
  apply(mode)
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // storage unavailable (private mode, etc.) — keep in-memory preference only
  }
})

export function toggleTheme() {
  theme.update((mode) => (mode === 'dark' ? 'light' : 'dark'))
}
