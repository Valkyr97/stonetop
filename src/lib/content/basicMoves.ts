/**
 * Shared basic moves every PC can make (Aid, Clash, Defy Danger, …).
 * Sourced from Splatbook's book-I pack; served from public/content/data.
 */

export interface BasicMove {
  id: string
  name: string
  text: string
  sectionId?: string
  rollsDamage?: boolean
}

export interface BasicMovesPack {
  id: string
  name: string
  moves: BasicMove[]
}

let cached: Promise<BasicMove[]> | null = null

/** Strip Obsidian wiki links `[[path|Label]]` → Label for sheet display. */
export function scrubBasicMoveText(text: string): string {
  return String(text ?? '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^For more information, see .+$/gim, '')
    .replace(/\n- /g, '\n• ')
    .replace(/^- /gm, '• ')
    .trim()
}

export async function fetchBasicMoves(): Promise<BasicMove[]> {
  if (cached) return cached
  cached = fetch('/content/data/basic-moves.json')
    .then(async (res) => {
      if (!res.ok) throw new Error(`basic-moves ${res.status}`)
      const pack = (await res.json()) as BasicMovesPack
      return pack.moves ?? []
    })
    .catch((err) => {
      cached = null
      console.warn('Failed to load basic moves', err)
      return [] as BasicMove[]
    })
  return cached
}
