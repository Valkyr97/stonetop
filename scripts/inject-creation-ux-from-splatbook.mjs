/**
 * Pull character-creation UX fields from Splatbook playbook JSON into
 * MyVersion's creation pack: extras (Details), introductions.steps,
 * custom instinct, origin prompt/notes, and pickOne → choice_groups.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const splatDir = path.join(root, '..', 'splatbook', 'content', 'stonetop', 'data')
const packPath = path.join(root, 'content', 'packs', 'creation-v0.1.json')
const publicPackPath = path.join(root, 'public', 'content', 'packs', 'creation-v0.1.json')
const manifestPath = path.join(root, 'content', 'manifest.json')

const idMap = {
  'the-blessed': 'blessed',
  'the-fox': 'fox',
  'the-heavy': 'heavy',
  'the-judge': 'judge',
  'the-lightbearer': 'lightbearer',
  'the-marshal': 'marshal',
  'the-ranger': 'ranger',
  'the-seeker': 'seeker',
  'the-would-be-hero': 'would-be-hero',
}

function slugify(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function mapOrigin(splatOrigin, existingOrigins) {
  const byLabel = new Map(existingOrigins.map((o) => [o.label.toLowerCase(), o]))
  const prompt = splatOrigin?.prompt ?? null
  const options = (splatOrigin?.options ?? []).map((opt) => {
    const existing =
      byLabel.get(opt.label.toLowerCase()) ||
      existingOrigins.find((o) => o.id === slugify(opt.label))
    if (existing) {
      return {
        ...existing,
        label: opt.label,
        ...(opt.note ? { note: opt.note } : existing.note ? { note: existing.note } : {}),
      }
    }
    return {
      id: slugify(opt.label),
      label: opt.label,
      ...(opt.note ? { note: opt.note } : {}),
      name_options: (opt.names ?? []).map((n) => ({ id: slugify(n), label: n })),
    }
  })
  // Keep Wild / generation origins MyVersion already has if Splatbook omitted them
  for (const o of existingOrigins) {
    if (o.name_generation && !options.some((x) => x.id === o.id || x.label === o.label)) {
      options.push(o)
    }
  }
  return { prompt, origins: options }
}

const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'))
let patched = 0

for (const [splatId, myId] of Object.entries(idMap)) {
  const file = path.join(splatDir, `${splatId}.json`)
  if (!fs.existsSync(file)) {
    console.warn(`missing ${file}`)
    continue
  }
  const splat = JSON.parse(fs.readFileSync(file, 'utf8'))
  const pb = pack.content.playbooks.find((p) => p.id === myId)
  if (!pb) {
    console.warn(`pack missing playbook ${myId}`)
    continue
  }

  pb.extras = splat.extras ?? []
  pb.introductions = {
    ...(pb.introductions ?? {}),
    intro: splat.introductions?.intro ?? pb.introductions?.intro,
    steps: splat.introductions?.steps ?? [],
  }

  // Ensure custom write-in instinct exists
  if (!pb.instincts.some((i) => i.id === 'custom' || i.custom)) {
    pb.instincts.push({ id: 'custom', label: '', description: null, custom: true })
  } else {
    for (const i of pb.instincts) {
      if (i.id === 'custom') i.custom = true
    }
  }

  if (splat.origins) {
    const mapped = mapOrigin(splat.origins, pb.origins ?? [])
    pb.origins_prompt = mapped.prompt
    pb.origins = mapped.origins
  }

  // Sync pickOne groups from Splatbook when present
  const pickOne = splat.moves?.starting?.pickOne
  if (Array.isArray(pickOne) && pickOne.length) {
    pb.starting_move_rules = {
      ...pb.starting_move_rules,
      fixed: pb.starting_move_rules?.fixed ?? splat.moves?.starting?.fixed ?? [],
      free_choices:
        pb.starting_move_rules?.free_choices ??
        splat.moves?.starting?.choose ??
        0,
      choice_groups: pickOne.map((options) => ({ choose: 1, options })),
      background_grants:
        pb.starting_move_rules?.background_grants ??
        pb.starting_move_rules?.background_additions ??
        true,
    }
  } else if (pb.starting_move_rules && !Array.isArray(pb.starting_move_rules.fixed)) {
    pb.starting_move_rules.fixed = []
  }

  patched++
  console.log(`${myId}: extras=${pb.extras.length} introSteps=${pb.introductions.steps.length}`)
}

fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`)
fs.writeFileSync(publicPackPath, `${JSON.stringify(pack, null, 2)}\n`)

const hash = crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const creation = manifest.packs.find((p) => p.id === 'creation')
if (creation) creation.sha256 = hash
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

const publicManifest = path.join(root, 'public', 'content', 'manifest.json')
if (fs.existsSync(publicManifest)) {
  const m2 = JSON.parse(fs.readFileSync(publicManifest, 'utf8'))
  const c2 = m2.packs.find((p) => p.id === 'creation')
  if (c2) c2.sha256 = hash
  fs.writeFileSync(publicManifest, `${JSON.stringify(m2, null, 2)}\n`)
}

console.log(`Patched ${patched} playbooks; sha256=${hash}`)
