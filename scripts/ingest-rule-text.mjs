/**
 * Ingest authoritative Stonetop rule prose (CC BY-SA 4.0) into content packs.
 *
 * Source: extracted marker-line text from
 *   https://github.com/Bryan-Legend/stonetop-wiki-generator
 * Corpus lines look like: C\t<b>LEGACY</b> prose... / P\tWhen you...
 *
 * Policy: never invent; only copy prose that appears in the extracted files.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'scripts', '.cache', 'stonetop-extracted')
const RAW_BASE =
  'https://raw.githubusercontent.com/Bryan-Legend/stonetop-wiki-generator/master/extracted'
const API_BOOK2 =
  'https://api.github.com/repos/Bryan-Legend/stonetop-wiki-generator/contents/extracted/book2'

const ATTRIBUTION = {
  text: 'Stonetop and Stonetop: The Wider World and Other Wonders by Jeremy Strandberg (Lampblack & Brimstone). All game text © the authors; released under CC BY-SA 4.0. Extracted marker-line corpus via Bryan-Legend/stonetop-wiki-generator (MIT for generator code; book text CC BY-SA 4.0). Artwork excluded.',
  license: 'CC BY-SA 4.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
  corpus: 'https://github.com/Bryan-Legend/stonetop-wiki-generator/tree/master/extracted',
  wiki: 'https://stonetop-wiki.github.io/',
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[''´`]/g, '')
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normKey(s) {
  return String(s)
    .toLowerCase()
    .replace(/\.txt$/, '')
    .replace(/[''´`]/g, '')
    .replace(/-/g, '')
}

function stripHtml(s) {
  let out = String(s)
    // Triggers in the book are bold+italic; tags are italic; roll results are bold.
    .replace(/<b><i>(.*?)<\/i><\/b>/gi, '***$1***')
    .replace(/<i><b>(.*?)<\/b><\/i>/gi, '***$1***')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00a0/g, ' ')
  // Extractor sometimes splits one phrase across adjacent tags.
  let prev
  do {
    prev = out
    out = out.replace(/\*\*\*([^*]+)\*\*\*\s+\*\*\*([^*]+)\*\*\*/g, '***$1 $2***')
    out = out.replace(/\*\*([^*]+)\*\*\s+\*\*([^*]+)\*\*/g, '**$1 $2**')
    out = out.replace(/\*([^*]+)\*\s+\*([^*]+)\*/g, '*$1 $2*')
  } while (out !== prev)
  return out
}

function countDiamonds(s) {
  const m = String(s).match(/^[◇]+/)
  return m ? m[0].length : 0
}

/** Ammo/use tracks printed as ◇ label ◇ label — not take-count prefixes. */
function isLabeledMarkTrack(textAfterLeadingDiamonds) {
  return /^(?:\*[^*]+\*|[^*◇\n]{1,40})\s*◇/.test(String(textAfterLeadingDiamonds).trim())
}

function peelLeadingBoxes(text) {
  const raw = String(text || '').trim()
  const m = raw.match(/^(◇+)\s*/)
  if (!m) return { boxes: 0, text: raw }
  const rest = raw.slice(m[0].length)
  if (isLabeledMarkTrack(rest)) return { boxes: 0, text: raw }
  return { boxes: m[1].length, text: rest.trim() }
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'stonetop-local-ingest/0.1 (personal CC BY-SA reuse)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

async function cachedFetch(relPath) {
  mkdirSync(CACHE, { recursive: true })
  const cachePath = join(CACHE, relPath.replace(/\//g, '__'))
  try {
    return readFileSync(cachePath, 'utf8')
  } catch {
    const text = await fetchText(`${RAW_BASE}/${relPath}`)
    writeFileSync(cachePath, text, 'utf8')
    return text
  }
}

function splitNameAndBody(rest) {
  const afterPrefix = String(rest).replace(/^[◇\s,]+/, '')
  const leadingBoxes = countDiamonds(stripHtml(rest).trim())
  const bold = afterPrefix.match(/^<b>(.*?)<\/b>\s*(.*)$/is)
  if (bold) {
    const afterName = stripHtml(bold[2] || '').trim()
    const peeled = peelLeadingBoxes(afterName)
    return {
      name: stripHtml(bold[1]).replace(/[◇]/g, '').trim(),
      body: peeled.text,
      boxes: peeled.boxes || leadingBoxes,
    }
  }
  const words = stripHtml(afterPrefix).split(/\s+/)
  let i = 0
  while (i < words.length) {
    const w = words[i].replace(/[◇]+/g, '')
    if (!w) {
      i++
      continue
    }
    if (w === '&' || /^[A-Z0-9][A-Z0-9'&.-]*$/.test(w)) {
      i++
      continue
    }
    break
  }
  const name = (i === 0 ? words.join(' ') : words.slice(0, i).join(' ')).replace(/[◇]/g, '').trim()
  const body = i === 0 ? '' : words.slice(i).join(' ').trim()
  const peeled = peelLeadingBoxes(body)
  return {
    name,
    body: peeled.text,
    boxes: peeled.boxes || leadingBoxes,
  }
}

function parseChoiceBlocks(text) {
  const lines = text.split(/\r?\n/)
  const bySlug = new Map()
  let section = ''
  let current = null

  const flush = () => {
    if (!current) return
    current.rule_text = current.parts.filter(Boolean).join('\n\n').trim()
    const slug = slugify(current.name)
    if (slug) {
      const prev = bySlug.get(slug)
      if (!prev || current.rule_text.length > prev.rule_text.length) {
        bySlug.set(slug, current)
      }
    }
    current = null
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF/, '')
    if (!line || line.startsWith('#')) continue
    if (/^PAGE\b/i.test(line) || line.startsWith('STATS') || line === 'HR') continue
    if (/^WRITE\b/i.test(line) || /^STEP\b/i.test(line)) continue

    const h = line.match(/^H([23])\t(.+)$/) || line.match(/^H([23])\s+(.+)$/)
    if (h) {
      flush()
      section = stripHtml(h[2]).trim()
      continue
    }

    const choice = line.match(/^(CX2|C2|CX|C)\t(.+)$/) || line.match(/^(CX2|C2|CX|C)\s+(.+)$/)
    if (choice) {
      flush()
      // Named entries in the corpus carry <b>TITLE</b>
      if (!choice[2].includes('<b>')) {
        current = null
        continue
      }
      const { name, body, boxes } = splitNameAndBody(choice[2])
      if (!name) {
        current = null
        continue
      }
      current = { name, section, marker: choice[1], boxes: boxes || 0, parts: body ? [body] : [] }
      continue
    }

    if (!current) continue
    const p = line.match(/^P\t(.*)$/) || line.match(/^P\s+(.*)$/)
    if (p) {
      const part = stripHtml(p[1]).trim()
      // Empty printed tracks (Stock: ◇◇◇…) are layout, not extra uses.
      if (/^Stock:\s*◇+$/i.test(part)) {
        current.boxes = Math.max(current.boxes || 0, 0)
        current.stock_track = (part.match(/◇/g) || []).length
        continue
      }
      // Footer for the blank "discuss with GM" write-in, not part of the prior item.
      if (/^\(discuss with GM\)$/i.test(part)) {
        flush()
        continue
      }
      current.parts.push(part)
      continue
    }
    const b = line.match(/^B\t(.*)$/) || line.match(/^B\s+(.*)$/)
    if (b) {
      current.parts.push(`• ${stripHtml(b[1]).trim()}`)
    }
  }
  flush()
  return bySlug
}

function applyRuleText(target, block, field = 'rule_text') {
  if (!block?.rule_text) return false
  let text = block.rule_text
  const peeled = peelLeadingBoxes(text)
  if (peeled.boxes) {
    text = peeled.text
    if (!block.boxes) block.boxes = peeled.boxes
  }
  // Printed stock/use tracks next to an item are layout, not extra uses.
  text = text.replace(/\n*Stock:\s*◇+\s*/gi, '').trim()
  target[field] = text
  if (block.boxes > 1) target.boxes = block.boxes
  if (/each time you take this move/i.test(text)) {
    target.repeatable = true
    if (!target.boxes) target.boxes = 3
  }
  if (target.boxes === 2 && /anger is a gift/i.test(block.name || '')) target.repeatable = true
  target.rule_text_status = 'ingested_cc_by_sa'
  target.rule_text_source = {
    license: 'CC BY-SA 4.0',
    section: block.section || null,
    name: block.name,
  }
  return true
}

function markUnmatched(target) {
  if (target.rule_text == null || target.rule_text === '') {
    target.rule_text = null
    target.rule_text_status = 'unmatched'
  }
}

/**
 * Resolve a corpus choice-block for a pack entry.
 * Handles common naming drift vs the extracted playbook text:
 * - possessive: "Luthier tools" ↔ "Luthier's tools"
 * - articles: "Good dog" ↔ "A good dog"
 * - "Your …": "Symbol of authority" ↔ "Your symbol of authority"
 * - longer corpus titles: "Personal token" ↔ "Personal token, fraught with meaning"
 */
function lookupBlock(blocks, name, id) {
  const keys = new Set()
  const add = (s) => {
    if (!s) return
    const slug = typeof s === 'string' && s.includes('-') && !/\s/.test(s) ? s : slugify(s)
    if (slug) keys.add(slug)
  }

  add(name)
  add(id)
  add(String(name || '').replace(/^(a|an|the|your)\s+/i, ''))

  for (const key of [...keys]) {
    // Toggle possessive -s on the first hyphen segment (luthier-tools ↔ luthiers-tools).
    keys.add(key.replace(/^([a-z]+)s-/, '$1-'))
    keys.add(key.replace(/^([a-z]+)-/, '$1s-'))
    // Leading article / "your" as used in printed headings.
    for (const prefix of ['a-', 'an-', 'the-', 'your-']) {
      keys.add(prefix + key)
    }
  }

  for (const key of keys) {
    const hit = blocks.get(key)
    if (hit) return hit
  }

  // Prefix match for titles that continue after a comma in the corpus.
  const base = slugify(name)
  if (base) {
    for (const [k, v] of blocks) {
      if (k.startsWith(`${base}-`)) return v
    }
  }

  return null
}

function extractSacredPouchBack(text) {
  const parts = []
  for (const line of String(text).split(/\r?\n/)) {
    const p = line.match(/^P\t(.*)$/)
    if (!p) continue
    const body = stripHtml(p[1]).trim()
    if (/sacred pouch .*doesn't take up space/i.test(body)) parts.push(body)
    else if (/replenish your Stock/i.test(body)) parts.push(body)
    else if (/produce Stock instead of provisions/i.test(body)) parts.push(body)
  }
  return parts.join('\n\n').trim()
}

async function ingestPlaybook(playbook) {
  const rawUrl = playbook.source?.raw
  if (!rawUrl) return { matched: 0, total: 0 }
  const rel = rawUrl.split('/extracted/')[1]
  if (!rel) return { matched: 0, total: 0 }
  const text = await cachedFetch(rel)
  const blocks = parseChoiceBlocks(text)

  let matched = 0
  let total = 0

  for (const bg of playbook.backgrounds ?? []) {
    total++
    const block = lookupBlock(blocks, bg.name, bg.id)
    if (applyRuleText(bg, block)) matched++
    else markUnmatched(bg)
  }

  for (const instinct of playbook.instincts ?? []) {
    total++
    const block = lookupBlock(blocks, instinct.label || instinct.name || instinct.id, instinct.id)
    if (block?.rule_text) {
      instinct.description = block.rule_text
      instinct.rule_text_status = 'ingested_cc_by_sa'
      matched++
    } else {
      instinct.description = instinct.description ?? null
      instinct.rule_text_status = 'unmatched'
    }
  }

  for (const move of playbook.moves ?? []) {
    total++
    const block = lookupBlock(blocks, move.name, move.id)
    if (applyRuleText(move, block)) matched++
    else markUnmatched(move)
  }

  const poss = playbook.special_possessions
  if (poss) {
    for (const item of [...(poss.fixed ?? []), ...(poss.options ?? [])]) {
      if (!item?.name || item.id === 'custom') continue
      total++
      const block = lookupBlock(blocks, item.name, item.id)
      if (applyRuleText(item, block)) matched++
      else markUnmatched(item)
      if (item.id === 'sacred-pouch') {
        const back = extractSacredPouchBack(text)
        if (back) item.rule_text = back
      }
    }
  }

  return { matched, total, blocks: blocks.size }
}

async function ingestInsert(insert) {
  const rawUrl = insert.source?.raw
  if (!rawUrl) return { matched: 0, total: 1 }
  const rel = rawUrl.split('/extracted/')[1]
  if (!rel) return { matched: 0, total: 1 }
  const text = await cachedFetch(rel)
  const body = text
    .split(/\r?\n/)
    .filter((l) => !l.startsWith('#') && !/^PAGE\b/i.test(l) && l !== 'HR')
    .map((l) => {
      if (/^H[23]\t/.test(l)) return `\n## ${stripHtml(l.replace(/^H[23]\t/, ''))}\n`
      if (/^H[23]\s/.test(l)) return `\n## ${stripHtml(l.slice(3))}\n`
      if (/^P\t/.test(l)) return stripHtml(l.slice(2))
      if (/^B\t/.test(l)) return `• ${stripHtml(l.slice(2))}`
      if (/^(CX2|C2|CX|C)\t/.test(l)) return `• ${stripHtml(l.replace(/^(CX2|C2|CX|C)\t/, ''))}`
      if (l.startsWith('STATS')) return ''
      if (/^WRITE\b/i.test(l) || /^STEP\b/i.test(l)) return stripHtml(l)
      return stripHtml(l)
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (body) {
    insert.rule_text = body
    insert.rule_text_status = 'ingested_cc_by_sa'
    insert.rule_text_source = { license: 'CC BY-SA 4.0', file: rel }
    return { matched: 1, total: 1 }
  }
  markUnmatched(insert)
  return { matched: 0, total: 1 }
}

async function buildArcanaFileIndex() {
  const res = await fetch(API_BOOK2, {
    headers: {
      'User-Agent': 'stonetop-local-ingest/0.1',
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const files = await res.json()
  const index = new Map()
  for (const f of files) {
    if (!f.name?.endsWith('.txt')) continue
    if (!f.name.startsWith('minor-') && !f.name.startsWith('major-')) continue
    index.set(normKey(f.name), `book2/${f.name}`)
  }
  return index
}

async function ingestArcanaCard(card, fileIndex) {
  const key = normKey(card.source_ref || card.id)
  const rel = fileIndex.get(key)
  if (!rel) {
    markUnmatched(card)
    return false
  }
  const text = await cachedFetch(rel)
  const lines = text.split(/\r?\n/)
  const parts = []
  let started = false
  const nameSlug = slugify(card.name)

  for (const line of lines) {
    if (line.startsWith('#') || /^PAGE\b/i.test(line) || line === 'HR') continue

    const h3 = line.match(/^H3\t(.+)$/) || line.match(/^H3\s+(.+)$/)
    if (h3) {
      const heading = stripHtml(h3[1]).trim()
      const hs = slugify(heading)
      if (hs === nameSlug || hs.includes(nameSlug) || nameSlug.includes(hs)) {
        started = true
        parts.length = 0
        continue
      }
      if (started) break
      continue
    }

    const pushLine = (raw) => {
      const t = stripHtml(raw).trim()
      if (t) parts.push(t)
    }

    if (!started) {
      if (/^P\t/.test(line)) pushLine(line.slice(2))
      else if (/^B\t/.test(line)) pushLine(`• ${line.slice(2)}`)
      else if (/^(CX2|C2|CX|C)\t/.test(line)) pushLine(`• ${line.replace(/^(CX2|C2|CX|C)\t/, '')}`)
      continue
    }

    if (/^P\t/.test(line)) pushLine(line.slice(2))
    else if (/^B\t/.test(line)) pushLine(`• ${line.slice(2)}`)
    else if (/^(CX2|C2|CX|C)\t/.test(line)) pushLine(`• ${line.replace(/^(CX2|C2|CX|C)\t/, '')}`)
  }

  let rule = parts.join('\n\n').trim()
  if (!rule) {
    rule = lines
      .filter((l) => !l.startsWith('#') && !/^PAGE\b/i.test(l) && l !== 'HR')
      .map((l) => stripHtml(l.replace(/^(H3|P|B|CX2|C2|CX|C)\t/, '').replace(/^(H3|P|B|CX2|C2|CX|C)\s+/, '')).trim())
      .filter(Boolean)
      .join('\n\n')
  }
  if (!rule) {
    markUnmatched(card)
    return false
  }
  card.rule_text = rule
  card.rule_text_status = 'ingested_cc_by_sa'
  card.rule_text_source = { license: 'CC BY-SA 4.0', file: rel }
  return true
}

function sha256File(path) {
  const buf = readFileSync(path)
  return createHash('sha256').update(buf).digest('hex')
}

async function main() {
  const creationPath = join(ROOT, 'content', 'packs', 'creation-v0.1.json')
  const arcanaPath = join(ROOT, 'content', 'packs', 'arcana-v0.1.json')
  const manifestPath = join(ROOT, 'content', 'manifest.json')

  const creation = JSON.parse(readFileSync(creationPath, 'utf8'))
  const arcana = JSON.parse(readFileSync(arcanaPath, 'utf8'))

  const stats = { playbooks: [], inserts: [], arcana: { matched: 0, total: 0 } }

  for (const pb of creation.content.playbooks) {
    process.stdout.write(`playbook ${pb.id}… `)
    const r = await ingestPlaybook(pb)
    stats.playbooks.push({ id: pb.id, ...r })
    console.log(`${r.matched}/${r.total} (blocks=${r.blocks})`)
  }

  for (const insert of creation.content.inserts ?? []) {
    process.stdout.write(`insert ${insert.id}… `)
    const r = await ingestInsert(insert)
    stats.inserts.push({ id: insert.id, ...r })
    console.log(`${r.matched}/${r.total}`)
  }

  creation._meta.version = '0.1.1'
  creation._meta.generated_on = new Date().toISOString().slice(0, 10)
  creation._meta.verification_policy.rule_prose = 'ingested_from_cc_by_sa_corpus'
  creation._meta.attribution = ATTRIBUTION
  creation._meta.ingestion = {
    at: new Date().toISOString(),
    stats,
    note: 'rule_text copied from extracted corpus; no invented prose',
  }

  console.log('Indexing arcana files…')
  const fileIndex = await buildArcanaFileIndex()
  console.log(`arcana files indexed: ${fileIndex.size}`)

  for (const card of [...arcana.arcana.minor, ...arcana.arcana.major]) {
    stats.arcana.total++
    if (await ingestArcanaCard(card, fileIndex)) stats.arcana.matched++
  }
  console.log(`arcana ${stats.arcana.matched}/${stats.arcana.total}`)

  arcana._meta.version = '0.1.1'
  arcana._meta.generated_on = new Date().toISOString().slice(0, 10)
  arcana._meta.policy.rule_prose_is_external = false
  arcana._meta.recommended_usage.rule_text = 'ingested_from_cc_by_sa_corpus'
  arcana._meta.attribution = ATTRIBUTION
  arcana._meta.ingestion = {
    at: new Date().toISOString(),
    matched: stats.arcana.matched,
    total: stats.arcana.total,
  }

  writeFileSync(creationPath, JSON.stringify(creation, null, 2) + '\n', 'utf8')
  writeFileSync(arcanaPath, JSON.stringify(arcana, null, 2) + '\n', 'utf8')

  for (const [src, dest] of [
    [creationPath, join(ROOT, 'stonetop_character_creation_v0.1.json')],
    [arcanaPath, join(ROOT, 'stonetop_arcana_normalized_v0.1.json')],
  ]) {
    try {
      writeFileSync(dest, readFileSync(src))
    } catch {
      /* optional */
    }
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.version = '0.1.1'
  manifest.generated_on = new Date().toISOString().slice(0, 10)
  for (const pack of manifest.packs) {
    pack.version = '0.1.1'
    pack.sha256 = sha256File(join(ROOT, 'content', pack.file))
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  console.log('Done. Manifest hashes updated.')
  console.log(JSON.stringify(stats, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
