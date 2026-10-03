/**
 * Sort playbook moves for the shared Moves catalog:
 * by min_level, then within a level nest same-level `requires` dependents
 * under their parent (Polyglot → Cryptologist).
 */
import type { MoveDef } from '../../content/types'

export interface CatalogRow {
  move: MoveDef
  /** Nesting depth within the same min_level (0 = root). */
  depth: number
}

function moveLevel(m: MoveDef): number {
  return m.min_level ?? 1
}

/** Plain move-id requires / replaces (ignore `id:full` / expression gates for tree edges). */
function sameLevelParents(move: MoveDef, byId: Map<string, MoveDef>): string[] {
  const level = moveLevel(move)
  const out: string[] = []
  for (const r of move.requires ?? []) {
    if (r.includes(':') || /\sOR\s/i.test(r) || /[><=]/.test(r)) continue
    const parent = byId.get(r)
    if (parent && moveLevel(parent) === level) out.push(r)
  }
  if (move.replaces) {
    const parent = byId.get(move.replaces)
    if (parent && moveLevel(parent) === level && !out.includes(move.replaces)) {
      out.push(move.replaces)
    }
  }
  return out
}

/**
 * Stable catalog order. O(n + e) over moves and require edges.
 * Cycles / missing parents fall back to roots at depth 0.
 */
export function sortMovesForCatalog(moves: readonly MoveDef[]): CatalogRow[] {
  const byId = new Map(moves.map((m) => [m.id, m]))
  const levels = [...new Set(moves.map(moveLevel))].sort((a, b) => a - b)
  const rows: CatalogRow[] = []

  for (const level of levels) {
    const bucket = moves.filter((m) => moveLevel(m) === level)
    const children = new Map<string, string[]>()
    const parentOf = new Map<string, string>()
    for (const m of bucket) {
      const parents = sameLevelParents(m, byId)
      // One parent edge for layout: first same-level require.
      const parent = parents[0]
      if (parent && bucket.some((b) => b.id === parent)) {
        parentOf.set(m.id, parent)
        const list = children.get(parent) ?? []
        list.push(m.id)
        children.set(parent, list)
      }
    }

    const roots = bucket.filter((m) => !parentOf.has(m.id))
    const visited = new Set<string>()

    function walk(id: string, depth: number) {
      if (visited.has(id)) return
      visited.add(id)
      const move = byId.get(id)
      if (!move) return
      rows.push({ move, depth })
      for (const childId of children.get(id) ?? []) walk(childId, depth + 1)
    }

    for (const root of roots) walk(root.id, 0)
    // Orphans in a cycle: still show them.
    for (const m of bucket) {
      if (!visited.has(m.id)) walk(m.id, 0)
    }
  }

  return rows
}
