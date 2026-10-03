import { describe, expect, it } from 'vitest'
import { CHARACTER_SCHEMA_VERSION } from '../../content/types'
import { migrateCharacterState, needsMigration } from './migrate'

describe('migrateCharacterState', () => {
  it('converts the old debilities string array to the object trio', () => {
    const legacy = {
      identity: { playbook_id: 'test-playbook' },
      mechanics: { debilities: ['weakened', 'miserable'], stats: {}, hp_current: 10, xp: 0, level: 1 },
      moves: { selected: ['fixed-move'] },
      inserts: {},
    }
    const migrated = migrateCharacterState(legacy)
    expect(migrated.mechanics.debilities).toEqual({ weakened: true, dazed: false, miserable: true })
    expect(migrated.schema_version).toBe(CHARACTER_SCHEMA_VERSION)
  })

  it('backfills advancement/trackers/flags when absent', () => {
    const legacy = { identity: {}, mechanics: { stats: {}, hp_current: 0, xp: 0, level: 1 }, moves: { selected: [] } }
    const migrated = migrateCharacterState(legacy)
    expect(migrated.mechanics.advancement).toEqual([])
    expect(migrated.mechanics.trackers).toEqual({})
    expect(migrated.mechanics.flags).toEqual({})
  })

  it('is idempotent on an already-current draft', () => {
    const legacy = { identity: {}, mechanics: { stats: {}, hp_current: 0, xp: 0, level: 1 }, moves: { selected: [] } }
    const once = migrateCharacterState(legacy)
    const twice = migrateCharacterState(once)
    expect(twice).toEqual(once)
  })

  it('strips selected copies that were also recorded in advancement', () => {
    const legacy = {
      identity: {},
      mechanics: {
        stats: {},
        hp_current: 0,
        xp: 0,
        level: 2,
        advancement: [{ level: 2, moveId: 'conduit-of-power' }],
      },
      moves: { selected: ['well-versed', 'conduit-of-power', 'attuned'] },
    }
    const migrated = migrateCharacterState(legacy)
    expect(migrated.moves.selected).toEqual(['well-versed', 'attuned'])
    expect(migrated.mechanics.advancement.map((e) => e.moveId)).toEqual(['conduit-of-power'])
  })
})

describe('needsMigration', () => {
  it('is true for undefined/old schema versions and false once current', () => {
    expect(needsMigration(undefined)).toBe(true)
    expect(needsMigration({ schema_version: 1 })).toBe(true)
    expect(needsMigration({ schema_version: CHARACTER_SCHEMA_VERSION })).toBe(false)
  })
})
