/**
 * Render Stonetop rule prose.
 * ***trigger*** → bold italic, **on a 7+** → bold, *tag* → italic
 * ◇ runs before "use(s)" → circles; other ◇ runs → diamond weight marks.
 */

function markRun(count: number, kind: 'box' | 'circle'): string {
  const cls = kind === 'circle' ? 'circle' : 'box'
  return `<span class="boxes" aria-hidden="true">${`<span class="${cls}"></span>`.repeat(count)}</span>`
}

export function renderRuleProse(text: string): string {
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Uses tracks printed as ◇◇ uses → circles (weight stays diamonds).
    .replace(/◇+(?=\s*uses?\b)/gi, (run) => markRun(run.length, 'circle'))
    .replace(/◇+/g, (run) => markRun(run.length, 'box'))
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n• /g, '</p><p class="bullet">• ')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
}

export function countPrintedBoxes(text: string | null | undefined): number {
  const m = String(text ?? '').trim().match(/^(◇+)/)
  return m ? m[1].length : 0
}

/**
 * True when leading ◇ are part of a printed label track
 * (`◇ a few left ◇ out`), not a take-count prefix to strip.
 */
export function isLabeledMarkTrack(textAfterLeadingDiamonds: string): boolean {
  return /^(?:\*[^*]+\*|[^*◇\n]{1,40})\s*◇/.test(String(textAfterLeadingDiamonds).trim())
}

export function stripLeadingBoxes(text: string | null | undefined): string {
  const raw = String(text ?? '')
  const m = raw.match(/^(◇+)\s*/)
  if (!m) return raw.replace(/\n*Stock:\s*◇+\s*/gi, '').trim()
  const rest = raw.slice(m[0].length)
  // Keep ammo/use tracks like ◇ *a few left* ◇ *out*
  if (isLabeledMarkTrack(rest)) return raw.replace(/\n*Stock:\s*◇+\s*/gi, '').trim()
  return rest.replace(/\n*Stock:\s*◇+\s*/gi, '').trim()
}

/** Remove a leading labeled mark track (`◇ *a few left* ◇ *out*`) from prose. */
export function stripLabeledMarkTrack(text: string | null | undefined): string {
  const raw = String(text ?? '').trim()
  if (!raw) return ''
  const m = raw.match(/^(◇+)\s*/)
  if (!m) return raw
  const rest = raw.slice(m[0].length)
  if (!isLabeledMarkTrack(rest)) return raw
  return raw
    .replace(/^(?:◇+\s*(?:\*[^*]+\*|[^*◇\n]{1,40})\s*)+/, '')
    .trim()
}
