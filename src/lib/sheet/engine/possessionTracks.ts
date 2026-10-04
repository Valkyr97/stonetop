/**
 * Lift spendable tracks (uses, ammo) off special-possession prose so the
 * sheet can render them like move ChoiceCards (title-row, top-right).
 */
export type PossessionUseTrack = {
  boxes: number
  markLabels: string[]
  title: string | null
  prose: string | null
}

const AMMO_PHRASE = String.raw`plenty left|a few left|low ammo|all out|out`

const AMMO_TRACK_RE = new RegExp(
  String.raw`[;,]?\s*◇+\s*(?:\*?(?:${AMMO_PHRASE})\*?)(?:\s*[,/]\s*|\s*◇+\s*|\s+)+(?:\*?(?:${AMMO_PHRASE})\*?)\s*◇*`,
  'i',
)

const LEADING_USES_RE = /^\s*\(?◇+\s*uses?\)?\s*:?\s*/i

const AMMO_TOKEN_RE = new RegExp(AMMO_PHRASE, 'gi')

export type PossessionTrackSource = {
  rule_text?: string | null
  usesMax?: number
}

function tidyProse(raw: string): string | null {
  const next = raw
    .replace(/◇+\s*$/g, '')
    .replace(/\(\s*[;,]?\s*\)/g, '')
    .replace(/\s*;\s*;/g, ';')
    .replace(/\s*;\s*$/g, '')
    .replace(/^\s*;\s*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  return next || null
}

function ammoLabelsFrom(chunk: string): string[] {
  AMMO_TOKEN_RE.lastIndex = 0
  const labels: string[] = []
  let m: RegExpExecArray | null
  while ((m = AMMO_TOKEN_RE.exec(chunk))) {
    labels.push(m[0].replace(/\*/g, '').toLowerCase())
  }
  return labels
}

export function possessionUseTrack(item: PossessionTrackSource): PossessionUseTrack {
  const raw = String(item.rule_text ?? '')
  const ammo = raw.match(AMMO_TRACK_RE)
  if (ammo) {
    const markLabels = ammoLabelsFrom(ammo[0])
    const boxes = Math.max(markLabels.length, (ammo[0].match(/◇/g) ?? []).length)
    return {
      boxes: Math.max(1, markLabels.length || boxes),
      markLabels,
      title: null,
      prose: tidyProse(raw.replace(AMMO_TRACK_RE, '')),
    }
  }

  const leadingUses = raw.match(LEADING_USES_RE)
  const diamondUses = leadingUses ? (leadingUses[0].match(/◇/g) ?? []).length : 0
  const packMax = typeof item.usesMax === 'number' && item.usesMax > 0 ? Math.floor(item.usesMax) : 0
  const boxes = packMax || diamondUses

  let prose = raw
  if (leadingUses) prose = raw.replace(LEADING_USES_RE, '')

  return {
    boxes,
    markLabels: [],
    title: null,
    prose: tidyProse(prose),
  }
}
