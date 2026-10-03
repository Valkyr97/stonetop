import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const splatDir = path.resolve(root, '../splatbook/content/stonetop/data')
const packPaths = [
  path.join(root, 'public/content/packs/creation-v0.1.json'),
  path.join(root, 'content/packs/creation-v0.1.json'),
]

const byId = new Map()
for (const f of fs.readdirSync(splatDir)) {
  if (!f.startsWith('the-') || !f.endsWith('.json')) continue
  if (f.includes('steading') || f.includes('gm')) continue
  const data = JSON.parse(fs.readFileSync(path.join(splatDir, f), 'utf8'))
  const list = data.moves?.list
  if (!Array.isArray(list)) continue
  for (const m of list) {
    if (!m?.id || !m.tracker?.boxes) continue
    byId.set(m.id, {
      boxes: Number(m.tracker.boxes),
      label: typeof m.tracker.label === 'string' ? m.tracker.label : undefined,
    })
  }
}

console.log('splat trackers', byId.size)
for (const [id, t] of [...byId.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${id}\t${t.boxes}\t${t.label ?? ''}`)
}

let patched = 0
for (const packPath of packPaths) {
  if (!fs.existsSync(packPath)) {
    console.warn('missing', packPath)
    continue
  }
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'))
  const playbooks = pack.content?.playbooks
  if (!Array.isArray(playbooks)) throw new Error(`no playbooks in ${packPath}`)
  for (const pb of playbooks) {
    for (const move of pb.moves ?? []) {
      const t = byId.get(move.id)
      if (!t) continue
      // Don't overwrite take-again / stat-bump box counts with play trackers.
      const takeAgain =
        !!move.repeatable ||
        /each time you take this move/i.test(String(move.rule_text ?? '')) ||
        move.id === 'improved-stat' ||
        move.id === 'superior-stat'
      if (takeAgain) continue
      move.tracker = { boxes: t.boxes, ...(t.label ? { label: t.label } : {}) }
      if (!(move.boxes > 1)) move.boxes = t.boxes
      patched++
    }
  }
  fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`)
  console.log('wrote', packPath, 'patches this pass', patched)
}
