/** Minimal synthetic playbook covering the advancement edge cases (repeat
 * caps, stat-bump moves, move-id `requires`, tracker-gated `requires`,
 * `replaces`) without depending on the full 10k-line content pack. */
import type { InsertDef, Playbook } from '../../content/types'

export function makeTestPlaybook(): Playbook {
  return {
    id: 'test-playbook',
    type: 'playbook',
    name: 'Test Playbook',
    base: { damage_die: 'd6', max_hp: 16, stat_array: [2, 1, 1, 0, 0, -1] },
    backgrounds: [
      { id: 'bg-a', name: 'Background A', grants: [{ type: 'move', id: 'granted-move' }] },
    ],
    instincts: [{ id: 'inst-a', label: 'Instinct A' }],
    appearance_groups: [],
    origins: [],
    starting_move_rules: { fixed: ['fixed-move'], background_grants: true, free_choices: 1 },
    moves: [
      { id: 'fixed-move', name: 'Fixed Move', min_level: 1, requires: [], replaces: null },
      { id: 'granted-move', name: 'Granted Move', min_level: 1, requires: [], replaces: null },
      { id: 'basic-move', name: 'Basic Move', min_level: 1, requires: [], replaces: null },
      {
        id: 'improved-stat',
        name: 'Improved Stat',
        min_level: 1,
        requires: [],
        replaces: null,
        boxes: 3,
        repeatable: true,
        creation_fields: [
          {
            key: 'stat',
            type: 'single_choice',
            options: ['STR', 'DEX', 'INT', 'WIS', 'CON', 'CHA'],
            constraint: 'increase by 1; cannot exceed +2 at this move',
          },
        ],
      },
      { id: 'tracked-move', name: 'Tracked Move', min_level: 2, requires: [], replaces: null, boxes: 3 },
      {
        id: 'gated-by-move',
        name: 'Gated By Move',
        min_level: 2,
        requires: ['tracked-move'],
        replaces: null,
      },
      {
        id: 'gated-by-tracker',
        name: 'Gated By Tracker',
        min_level: 2,
        requires: ['tracked-move:full'],
        replaces: null,
      },
      {
        id: 'upgrade-move',
        name: 'Upgrade Move',
        min_level: 3,
        requires: [],
        replaces: 'basic-move',
      },
      { id: 'high-level-move', name: 'High Level Move', min_level: 6, requires: [], replaces: null },
    ],
  }
}

export const TEST_INSERTS: InsertDef[] = [
  { id: 'inventory', type: 'insert', name: 'Inventory', granted_to_all: true },
  {
    id: 'auto-by-move',
    type: 'insert',
    name: 'Auto By Move',
    creation_required_when: { character_has_move: 'granted-move' },
  },
  {
    id: 'auto-by-playbook',
    type: 'insert',
    name: 'Auto By Playbook',
    creation_required_when: { playbook: 'test-playbook' },
  },
  { id: 'followers', type: 'insert', name: 'Followers', manual: true },
]
