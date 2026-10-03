import type { LocalGrant } from '../db/idb'
import type { ArcanaCard, InsertDef } from '../content/types'

export function grantsForType(grants: LocalGrant[], contentType: string) {
  return grants.filter((g) => g.content_type === contentType)
}

export function hasGrant(grants: LocalGrant[], contentType: string, contentId: string) {
  return grants.some((g) => g.content_type === contentType && g.content_id === contentId)
}

export function grantVisibility(
  grants: LocalGrant[],
  contentType: string,
  contentId: string,
): 'none' | 'front_only' | 'full' {
  const g = grants.find((x) => x.content_type === contentType && x.content_id === contentId)
  if (!g) return 'none'
  return g.visibility === 'full' ? 'full' : 'front_only'
}

export function visibleArcana(grants: LocalGrant[], cards: ArcanaCard[]) {
  return cards
    .map((card) => {
      const type = card.type === 'major_arcanum' ? 'arcana_major' : 'arcana_minor'
      const visibility = grantVisibility(grants, type, card.id)
      return { card, visibility }
    })
    .filter((x) => x.visibility !== 'none')
}

export function canSeeReverse(visibility: 'none' | 'front_only' | 'full') {
  return visibility === 'full'
}

/**
 * Manual insert ids (followers/ghost/revenant/thrall/etc.) the GM has hung
 * for this character via `content_grants` (`content_type: 'insert'`).
 * These are what feed the play binder's "+" menu — a manual insert is
 * never player-attachable until it shows up here. See
 * `engine/inserts.ts` for the auto-attach side (class inserts, which never
 * need a grant).
 */
export function visibleManualInsertIds(grants: LocalGrant[], inserts: InsertDef[]): string[] {
  const grantedIds = new Set(grantsForType(grants, 'insert').map((g) => g.content_id))
  return inserts.filter((i) => i.manual && grantedIds.has(i.id)).map((i) => i.id)
}
