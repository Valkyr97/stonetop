import { describe, expect, it } from 'vitest'
import { OUTFIT_CATALOG } from '../../content/inventoryOutfit'
  import {
    addCustomGear,
    addCustomOption,
    alignDeclaredBandIfCrossed,
    alignDeclaredBandToLoad,
    dropGear,
    effectiveItemUses,
    effectiveItemUsesMax,
    gearLoad,
    itemUsesMax,
    leaveGear,
    leaveSmallItem,
    loadBandIdForState,
    loadBandProgress,
    loadReminder,
    pickGear,
    readInventory,
    resetOutfitKit,
    setItemUsesMarked,
    setItemUsesMaxOverride,
    setLoadBandId,
    setLoadBandsOverride,
    setProsperity,
    takeGear,
    takeSmallItem,
    toggleGear,
  } from './inventory'
import {
  addCustomTracker,
  bumpCustomTracker,
  readCustomTrackers,
  removeCustomTracker,
  syncTrackers,
} from './trackers'
import { emptyCharacterState, type Playbook } from '../../content/types'
import { xpForNextLevel } from './advancement'

const catalog = OUTFIT_CATALOG

describe('inventory custom gear + bands', () => {
  it('migrates writeIns into customGear with zero slots', () => {
    const state = readInventory({ writeIns: ['Crowbar', ''] })
    expect(state.customGear?.map((g) => g.name)).toEqual(['Crowbar'])
    expect(state.customGear?.[0]?.slots).toBe(0)
    expect(state.customOptions?.map((o) => o.name)).toEqual(['Crowbar'])
  })

  it('counts custom gear slots in load', () => {
    let state = readInventory({})
    state = addCustomGear(state, { name: 'Iron hauberk', slots: 2 })
    expect(gearLoad(state, catalog)).toBe(2)
  })

  it('reminds against declared Light/Normal/Heavy band', () => {
    let state = readInventory({})
    state = toggleGear(state, 'Shield')
    state = setLoadBandId(state, 'light')
    const rem = loadReminder(state, catalog)
    expect(rem.bandId).toBe('light')
    expect(rem.load).toBeGreaterThan(0)
    expect(rem.text).toMatch(/Light/i)
  })

  it('sticky progress follows counted load into each band', () => {
    let state = readInventory({})
    expect(state.loadBandId).toBe('light')
    expect(loadBandProgress(state, catalog).text).toBe('Light 0/3')

    state = takeGear(state, 'Bedroll') // 1◇
    expect(loadBandProgress(state, catalog).text).toBe('Light 1/3')

    state = takeGear(state, 'Mess kit') // +1 → 2
    state = takeGear(state, 'Blanket') // +1 → 3
    expect(loadBandProgress(state, catalog).text).toBe('Light 3/3')

    state = takeGear(state, 'Rope, ~25 ft') // +1 → 4
    expect(loadBandProgress(state, catalog).text).toBe('Normal 4/6')

    state = takeGear(state, 'Shovel') // 5
    state = takeGear(state, 'Torch') // 6
    expect(loadBandProgress(state, catalog).text).toBe('Normal 6/6')

    state = takeGear(state, 'Oil lamp') // 7
    expect(loadBandProgress(state, catalog).text).toBe('Heavy 7/9')
  })

  it('aligns declared band when load crosses a threshold, keeps manual until then', () => {
    let state = readInventory({})
    state = takeGear(state, 'Bedroll')
    state = takeGear(state, 'Mess kit')
    state = takeGear(state, 'Blanket')
    state = takeGear(state, 'Rope, ~25 ft') // 4 → Normal
    state = alignDeclaredBandToLoad(state, catalog)
    expect(state.loadBandId).toBe('normal')

    // Manual override to Heavy while still at Normal load
    state = setLoadBandId(state, 'heavy')
    expect(state.loadBandId).toBe('heavy')

    // Drop within Normal — override sticks
    const before = state
    state = dropGear(state, 'Rope, ~25 ft') // 3 → Light (crosses!)
    state = alignDeclaredBandIfCrossed(before, state, catalog)
    expect(loadBandIdForState(state, catalog)).toBe('light')
    expect(state.loadBandId).toBe('light')

    // Manual Heavy again at Light load
    state = setLoadBandId(state, 'heavy')
    const before2 = state
    state = dropGear(state, 'Blanket') // still Light
    state = alignDeclaredBandIfCrossed(before2, state, catalog)
    expect(state.loadBandId).toBe('heavy')
  })

  it('uses loadBandsOverride for Pack Horse style thresholds', () => {
    let state = readInventory({})
    state = setLoadBandsOverride(state, [
      { name: 'light load', marks: 'up to 4' },
      { name: 'normal load', marks: '5-7' },
      { name: 'heavy load', marks: '8-10' },
    ])
    state = setLoadBandId(state, 'light')
    const rem = loadReminder(state, catalog)
    expect(rem.rangeText).toMatch(/4/)
  })

  it('dropped gear stays in kit but adds 0 load', () => {
    let state = takeGear(readInventory({}), 'Shield')
    const before = gearLoad(state, catalog)
    expect(before).toBeGreaterThan(0)
    state = dropGear(state, 'Shield')
    expect(state.gear).toContain('Shield')
    expect(gearLoad(state, catalog)).toBe(0)
    state = pickGear(state, 'Shield')
    expect(gearLoad(state, catalog)).toBe(before)
  })

  it('leave removes from kit; reset clears kit and undefined', () => {
    let state = takeGear(readInventory({}), 'Shield')
    state = addCustomOption(state, { name: 'Lantern hook', size: 'big', slots: 1 })
    state = { ...state, undefinedGear: 2 }
    const optionId = state.customOptions![0]!.id
    state = leaveGear(state, 'Shield')
    expect(state.gear).not.toContain('Shield')
    state = resetOutfitKit(state)
    expect(state.gear).toEqual([])
    expect(state.customGear).toEqual([])
    expect(state.undefinedGear).toBe(0)
    expect(state.customOptions?.some((o) => o.id === optionId)).toBe(true)
  })
})

describe('item uses tracks', () => {
  it('parses pure and Prosperity formulas', () => {
    expect(itemUsesMax(2)).toBe(2)
    expect(itemUsesMax('2')).toBe(2)
    expect(itemUsesMax('4+Prosperity')).toBe(4)
    expect(itemUsesMax('4+Prosperity', 2)).toBe(6)
    expect(itemUsesMax(undefined)).toBe(0)
  })

  it('defaults to full uses and tap-marks remaining', () => {
    let state = takeGear(readInventory({}), 'Supplies')
    const max = itemUsesMax('4+Prosperity', state.prosperity ?? 0)
    expect(max).toBe(4)
    expect(effectiveItemUses(state, 'Supplies', max)).toBe(4)

    state = setItemUsesMarked(state, 'Supplies', 2, max)
    expect(effectiveItemUses(state, 'Supplies', max)).toBe(2)

    state = setProsperity(state, 1)
    const wider = itemUsesMax('4+Prosperity', state.prosperity ?? 0)
    expect(wider).toBe(5)
    expect(effectiveItemUses(state, 'Supplies', wider)).toBe(2)
  })

  it('overrides uses track length in edit', () => {
    let state = takeGear(readInventory({}), 'Supplies')
    expect(effectiveItemUsesMax(state, 'Supplies', '4+Prosperity')).toBe(4)
    state = setItemUsesMaxOverride(state, 'Supplies', 6, '4+Prosperity')
    expect(effectiveItemUsesMax(state, 'Supplies', '4+Prosperity')).toBe(6)
    state = setItemUsesMarked(state, 'Supplies', 6, 6)
    state = setItemUsesMaxOverride(state, 'Supplies', 3, '4+Prosperity')
    expect(effectiveItemUsesMax(state, 'Supplies', '4+Prosperity')).toBe(3)
    expect(effectiveItemUses(state, 'Supplies', 3)).toBe(3)
  })

  it('clears uses when leaving kit items', () => {
    let state = takeSmallItem(readInventory({}), 'Whisky, skin')
    state = setItemUsesMarked(state, 'Whisky, skin', 1, 2)
    expect(effectiveItemUses(state, 'Whisky, skin', 2)).toBe(1)
    state = leaveSmallItem(state, 'Whisky, skin')
    expect(state.itemUsesMarked?.['Whisky, skin']).toBeUndefined()
  })
})

describe('custom trackers', () => {
  const playbook = {
    id: 'fox',
    type: 'playbook',
    name: 'The Fox',
    base: { damage_die: 'd8', max_hp: 16, stat_array: [2, 1, 1, 0, 0, -1] },
    backgrounds: [],
    instincts: [],
    appearance_groups: [],
    origins: [],
    starting_move_rules: { fixed: [], free_choices: 0 },
    moves: [{ id: 'silver-tongued', name: 'Silver Tongued', boxes: 3 }],
  } as unknown as Playbook

  it('adds and bumps tokens without sync wiping them', () => {
    let state = emptyCharacterState(playbook)
    state.mechanics.customTrackers = addCustomTracker(state, 'Readiness', 3)
    expect(readCustomTrackers(state)[0]?.label).toBe('Readiness')
    state.mechanics.customTrackers = bumpCustomTracker(state, 0, 2)
    expect(readCustomTrackers(state)[0]?.marked).toBe(2)

    state.moves.selected = ['silver-tongued']
    state.mechanics.trackers = syncTrackers(state, playbook)
    expect(readCustomTrackers(state)[0]?.marked).toBe(2)
    expect(state.mechanics.trackers['silver-tongued']?.boxes).toBe(3)
  })

  it('removes custom tokens by index', () => {
    let state = emptyCharacterState(playbook)
    state.mechanics.customTrackers = addCustomTracker(state, 'A', 2)
    state.mechanics.customTrackers = addCustomTracker(state, 'B', 2)
    state.mechanics.customTrackers = removeCustomTracker(state, 0)
    expect(readCustomTrackers(state).map((t) => t.label)).toEqual(['B'])
  })
})

describe('XP box sizing', () => {
  it('sizes the next-level row from xpForNextLevel', () => {
    expect(xpForNextLevel(1)).toBe(8)
    expect(xpForNextLevel(2)).toBe(10)
  })
})
