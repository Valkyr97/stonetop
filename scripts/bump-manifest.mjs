import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cpSync, mkdirSync, existsSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'content')
const manifestPath = join(contentDir, 'manifest.json')

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.version = '0.1.4'
manifest.generated_on = new Date().toISOString().slice(0, 10)
for (const pack of manifest.packs) {
  pack.version = pack.id === 'creation' ? '0.1.4' : pack.version
  pack.sha256 = sha256File(join(contentDir, pack.file))
  console.log(pack.id, pack.version, pack.sha256)
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

const dest = join(root, 'public', 'content')
mkdirSync(dest, { recursive: true })
cpSync(contentDir, dest, { recursive: true })
console.log('manifest bumped to', manifest.version, 'and copied to public/')
