import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const flavorsDir = path.join(root, '..', 'splatbook', 'static', 'content-packs', 'stonetop', 'data')
const packPath = path.join(root, 'content', 'packs', 'creation-v0.1.json')
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

const flavors = {}
for (const [splatId, myId] of Object.entries(idMap)) {
  const file = path.join(flavorsDir, `${splatId}.json`)
  const j = JSON.parse(fs.readFileSync(file, 'utf8'))
  flavors[myId] = j.flavor
  console.log(`${myId}: ${String(j.flavor).slice(0, 48)}…`)
}

const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'))
let n = 0
for (const pb of pack.content.playbooks) {
  if (flavors[pb.id]) {
    pb.flavor = flavors[pb.id]
    n++
  }
}
fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`)

const hash = crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const creation = manifest.packs.find((p) => p.id === 'creation')
creation.sha256 = hash
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`Patched ${n} playbooks; sha256=${hash}`)
