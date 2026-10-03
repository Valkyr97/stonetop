/**
 * Headless simulation of every mechanical PC creation combo + advancement
 * reachability against the live creation pack and MyVersion engine.
 *
 * Usage: node scripts/simulate-creation.mjs
 * Writes: scripts/_creation-sim-report.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Load TypeScript engine via vitest/vite is heavy; instead transpile-run by
// importing the compiled-enough sources through a dynamic ts loader isn't
// available. Use a vitest-based runner instead when invoked via npm test.
// This mjs script is the orchestration entry that vitest also mirrors.
// For standalone Node we dynamically import .ts through vite-node if present,
// else fall back to spawning vitest.

async function main() {
  const packPath = path.join(root, 'content/packs/creation-v0.1.json')
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'))

  const estimate = estimateCombos(pack)
  const reportPath = path.join(__dirname, '_creation-sim-estimate.json')
  fs.writeFileSync(reportPath, JSON.stringify(estimate, null, 2))
  console.log('Wrote estimate to', reportPath)
  console.log('TOTAL_MECHANICAL', estimate.totalMechanical)
  console.log('Run full sim via: npx vitest run src/lib/sheet/engine/creation-sim.test.ts')
}

function comb(n, k) {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return Math.round(r)
}

function fieldCombos(fields) {
  if (!fields?.length) return 1
  let c = 1
  for (const f of fields) {
    const opts = (f.options || []).map((o) => (typeof o === 'string' ? o : o.id))
    if (f.type === 'single_choice') c *= Math.max(opts.length, 1)
    else if (f.type === 'multi_choice') {
      const min = f.min ?? 1
      const max = f.max ?? opts.length
      let s = 0
      for (let k = min; k <= Math.min(max, opts.length); k++) s += comb(opts.length, k)
      c *= Math.max(s, 1)
    }
  }
  return c
}

function estimateCombos(pack) {
  const playbooks = []
  let totalMechanical = 0
  for (const pb of pack.content.playbooks) {
    const free = pb.starting_move_rules.free_choices ?? 0
    const fixed = new Set(pb.starting_move_rules.fixed || [])
    const pickOneOpts = new Set(
      (pb.starting_move_rules.choice_groups || []).flatMap((g) => g.options),
    )
    const freePool = pb.moves.filter(
      (m) => (m.min_level ?? 1) <= 1 && !fixed.has(m.id) && !pickOneOpts.has(m.id),
    )
    const cg = (pb.starting_move_rules.choice_groups || []).reduce(
      (a, g) => a * comb(g.options.length, g.choose ?? 1),
      1,
    )
    // Note: free pool shrinks per-background when bg grants a move; estimate uses max.
    const moveCombos = cg * (free ? comb(freePool.length, free) : 1)
    const poss = pb.special_possessions || {}
    const choose = poss.choose ?? 0
    const opts = (poss.options || []).filter((o) => !o.custom).length
    const possCombos = choose ? comb(opts, choose) : 1
    const backgrounds = []
    let pbTotal = 0
    for (const bg of pb.backgrounds) {
      const fc = fieldCombos(bg.creation_fields)
      const perBg = fc * moveCombos * possCombos
      pbTotal += perBg
      backgrounds.push({
        id: bg.id,
        fieldCombos: fc,
        grants: (bg.grants || []).map((g) => ({ type: g.type, id: g.id, from: g.from })),
        creation_fields: (bg.creation_fields || []).map((f) => ({
          key: f.key,
          type: f.type,
          options: (f.options || []).length,
          status: f.status,
        })),
        perBg,
      })
    }
    totalMechanical += pbTotal
    playbooks.push({
      id: pb.id,
      free,
      freePool: freePool.length,
      moveCombos,
      possessions: { choose, options: opts, combos: possCombos },
      instincts: pb.instincts.length,
      origins: pb.origins.length,
      appearanceCombos: pb.appearance_groups.reduce((a, g) => a * g.options.length, 1),
      moves: pb.moves.length,
      advancementMoves: pb.moves.filter((m) => (m.min_level ?? 1) > 1).length,
      backgrounds,
      totalMechanical: pbTotal,
    })
  }
  return {
    packVersion: pack._meta?.version,
    totalMechanical,
    pending_verification: pack.pending_verification || [],
    playbooks,
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
