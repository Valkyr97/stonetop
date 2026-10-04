import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'content')
const dest = join(root, 'public', 'content')

if (!existsSync(src)) {
  console.error('Missing content/ directory')
  process.exit(1)
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function refreshManifestHashes(dir) {
  const manifestPath = join(dir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const pack of manifest.packs) {
    pack.sha256 = sha256File(join(dir, pack.file))
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

mkdirSync(dest, { recursive: true })
refreshManifestHashes(src)
cpSync(src, dest, { recursive: true })
console.log('Copied content/ → public/content/')
