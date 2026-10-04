/**
 * Outfit / Inventory rules (Stonetop Book I), adapted from Splatbook's
 * inventory engine. Character state lives under `sheet.inserts.inventory`.
 *
 * Outfit modal chooses the expedition kit (Take / Leave). Inventory tab shows
 * only the kit and Drop / Pick (dropped items stay listed but add 0 load).
 * Custom options added in Outfit persist for that PC forever.
 */
export interface OutfitGear {
  name: string
  slots: number
  tags?: string[]
  text?: string
  uses?: string
  note?: string
  ammo?: string[]
}

/** Fields that can form a player-facing item description. */
export type ItemBlurbSource = {
  text?: string
  note?: string
  tags?: string[]
  uses?: string | number
  ammo?: string[]
}

/** Compact description line for outfit / inventory rows (excludes uses — those sit by the name). */
export function itemBlurb(item: ItemBlurbSource | null | undefined): string {
  if (!item) return ''
  const parts: string[] = []
  if (typeof item.text === 'string' && item.text.trim()) parts.push(item.text.trim())
  if (typeof item.note === 'string' && item.note.trim()) parts.push(item.note.trim())
  if (item.tags?.length) parts.push(item.tags.join(', '))
  if (item.ammo?.length) parts.push(item.ammo.join(' → '))
  return parts.join(' · ')
}

/** Uses label for Outfit rows, e.g. `uses 4+Prosperity` or `uses 2`. */
export function itemUsesLabel(item: ItemBlurbSource | null | undefined): string {
  if (!item || item.uses == null) return ''
  const u = String(item.uses).trim()
  return u ? `uses ${u}` : ''
}

/**
 * How many use boxes an item tracks.
 * Pure numbers → that many; `N+Prosperity` → N + steading Prosperity (default 0).
 */
export function itemUsesMax(
  uses: string | number | null | undefined,
  prosperity = 0,
): number {
  if (uses == null) return 0
  if (typeof uses === 'number') {
    return Number.isFinite(uses) && uses > 0 ? Math.floor(uses) : 0
  }
  const s = String(uses).trim()
  if (!s) return 0
  const pure = /^(\d+)$/.exec(s)
  if (pure) return Number(pure[1])
  const withP = /^(\d+)\s*\+\s*Prosperity\b/i.exec(s)
  if (withP) return Math.max(0, Number(withP[1]) + Math.floor(prosperity))
  return 0
}

export function catalogGear(
  catalog: OutfitCatalog,
  name: string,
): OutfitGear | undefined {
  return catalog.gear.find((g) => g.name === name)
}

export function catalogSmallItem(
  catalog: OutfitCatalog,
  name: string,
): OutfitCatalog['smallItems']['options'][number] | undefined {
  return catalog.smallItems.options.find((o) => o.name === name)
}

export interface OutfitLoadBand {
  name: string
  tags?: string[]
  marks: string
}

export interface OutfitCatalog {
  outfit: {
    text: string
    loads: OutfitLoadBand[]
    undefinedSlots: number
    undefinedText: string
  }
  gear: OutfitGear[]
  smallItems: {
    text: string
    undefinedSlots: number
    undefinedText: string
    options: { name: string; tags?: string[]; text?: string; uses?: number; ammo?: string[] }[]
  }
}

export type LoadBandId = 'light' | 'normal' | 'heavy'

export interface CustomGearItem {
  id: string
  name: string
  /** ◇ counted in load (0 for fluff / narrative). */
  slots: number
  tags?: string[]
  text?: string
  armor?: number
}

/** Permanent Add-custom catalog entry for this PC (Outfit modal). */
export interface CustomOutfitOption {
  id: string
  name: string
  size: 'small' | 'big'
  /** ◇ for big items (ignored for small). */
  slots?: number
}

export interface InventoryState {
  /** Catalog gear names currently in the expedition kit. */
  gear: string[]
  /** Catalog small-item names currently in the kit. */
  smallItems: string[]
  undefinedGear: number
  undefinedSmall: number
  /** Legacy free-text lines; migrated into customOptions + customGear on read. */
  writeIns?: string[]
  notes?: string
  /**
   * Effective load for a carried gear item (0…printed slots).
   * Keys are catalog gear names or customGear ids.
   */
  gearLoadOverride?: Record<string, number>
  /**
   * Remaining uses marked for a kit item (0…usesMax).
   * Keys are catalog gear/small names or custom option ids.
   * Missing key = full uses (just taken).
   */
  itemUsesMarked?: Record<string, number>
  /** Override printed uses-track length (0…10). Missing = catalog default. */
  itemUsesMaxOverride?: Record<string, number>
  /** Steading Prosperity used for `N+Prosperity` use tracks (default 0). */
  prosperity?: number
  /** Taken custom big items (ids match customOptions when size=big). */
  customGear?: CustomGearItem[]
  /** Declared expedition load (Light / Normal / Heavy). */
  loadBandId?: LoadBandId
  /** Optional override of catalog load band marks (Pack Horse style). */
  loadBandsOverride?: OutfitLoadBand[]
  /** Kit items that are dropped (listed, 0 load). */
  droppedGear?: string[]
  droppedSmall?: string[]
  droppedCustom?: string[]
  /** Permanent custom options available in the Outfit modal. */
  customOptions?: CustomOutfitOption[]
}

export const LOAD_BAND_IDS: LoadBandId[] = ['light', 'normal', 'heavy']
export const DEFAULT_LOAD_BAND_ID: LoadBandId = 'light'

export const LOAD_BAND_LABELS: Record<LoadBandId, string> = {
  light: 'Light',
  normal: 'Normal',
  heavy: 'Heavy',
}

/** Sticky readout: which band the counted load sits in, as `current/bandMax`. */
export function loadBandProgress(
  state: InventoryState,
  catalog: OutfitCatalog,
): {
  load: number
  label: string
  bandMax: number
  bandMin: number
  overMax: boolean
  text: string
} {
  const load = gearLoad(state, catalog)
  const bands = effectiveLoadBands(state, catalog)
  const absoluteMax = maxLoad(catalog, state)
  const overMax = load > absoluteMax

  let matched: OutfitLoadBand | null = null
  for (const band of bands) {
    const [min, max] = parseMarks(band.marks)
    if (load >= min && load <= max) {
      matched = band
      break
    }
  }
  // Over the last band's max → still show the heaviest band's ceiling.
  if (!matched && bands.length) {
    matched = bands[bands.length - 1] ?? null
  }

  const [bandMin, bandMax] = matched ? parseMarks(matched.marks) : [0, absoluteMax]
  const id = matched ? bandIdFromName(matched.name) : null
  const label = id ? LOAD_BAND_LABELS[id] : (matched?.name.replace(/\s*load$/i, '') ?? 'Load')
  const text = overMax
    ? `! Overloaded ${load}/${absoluteMax}`
    : `${label} ${load}/${bandMax}`

  return { load, label, bandMax, bandMin, overMax, text }
}

export function emptyInventoryState(): InventoryState {
  return {
    gear: [],
    smallItems: [],
    undefinedGear: 0,
    undefinedSmall: 0,
    writeIns: [],
    notes: '',
    customGear: [],
    customOptions: [],
    droppedGear: [],
    droppedSmall: [],
    droppedCustom: [],
    loadBandId: DEFAULT_LOAD_BAND_ID,
    gearLoadOverride: {},
    itemUsesMarked: {},
    itemUsesMaxOverride: {},
    prosperity: 0,
  }
}

function newId(): string {
  return `cg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function migrateWriteIns(raw: Partial<InventoryState>): CustomGearItem[] {
  const existing = Array.isArray(raw.customGear)
    ? raw.customGear
        .filter((g) => g && typeof g === 'object')
        .map((g) => ({
          id: String((g as CustomGearItem).id || newId()),
          name: String((g as CustomGearItem).name ?? ''),
          slots: Math.max(0, Number((g as CustomGearItem).slots) || 0),
          tags: Array.isArray((g as CustomGearItem).tags)
            ? (g as CustomGearItem).tags!.map(String)
            : undefined,
          text:
            typeof (g as CustomGearItem).text === 'string'
              ? (g as CustomGearItem).text
              : undefined,
          armor:
            typeof (g as CustomGearItem).armor === 'number'
              ? (g as CustomGearItem).armor
              : undefined,
        }))
    : []
  if (existing.length) return existing
  const lines = Array.isArray(raw.writeIns) ? raw.writeIns.map(String) : []
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ id: newId(), name, slots: 0 }))
}

function migrateCustomOptions(
  raw: Partial<InventoryState>,
  customGear: CustomGearItem[],
): CustomOutfitOption[] {
  if (Array.isArray(raw.customOptions) && raw.customOptions.length) {
    return raw.customOptions
      .filter((o) => o && typeof o === 'object')
      .map((o) => {
        const size = (o as CustomOutfitOption).size === 'small' ? 'small' : 'big'
        return {
          id: String((o as CustomOutfitOption).id || newId()),
          name: String((o as CustomOutfitOption).name ?? ''),
          size,
          slots:
            size === 'big'
              ? Math.max(0, Number((o as CustomOutfitOption).slots) || 1)
              : undefined,
        }
      })
  }
  // Legacy: promote existing customGear into permanent options.
  return customGear.map((g) => ({
    id: g.id,
    name: g.name,
    size: 'big' as const,
    slots: g.slots,
  }))
}

export function readInventory(blob: unknown): InventoryState {
  const raw = (blob ?? {}) as Partial<InventoryState>
  const loadBandId =
    raw.loadBandId === 'light' || raw.loadBandId === 'normal' || raw.loadBandId === 'heavy'
      ? raw.loadBandId
      : DEFAULT_LOAD_BAND_ID
  const overrideBands = Array.isArray(raw.loadBandsOverride)
    ? raw.loadBandsOverride
        .filter((b) => b && typeof b === 'object')
        .map((b) => ({
          name: String(b.name ?? ''),
          marks: String(b.marks ?? ''),
          tags: Array.isArray(b.tags) ? b.tags.map(String) : undefined,
        }))
    : undefined
  const customGear = migrateWriteIns(raw)
  const customOptions = migrateCustomOptions(raw, customGear)
  const gear = Array.isArray(raw.gear) ? raw.gear.map(String) : []
  const smallItems = Array.isArray(raw.smallItems) ? raw.smallItems.map(String) : []
  const droppedGear = uniqueStrings(
    (Array.isArray(raw.droppedGear) ? raw.droppedGear.map(String) : []).filter((id) =>
      gear.includes(id),
    ),
  )
  const droppedSmall = uniqueStrings(
    (Array.isArray(raw.droppedSmall) ? raw.droppedSmall.map(String) : []).filter((id) =>
      smallItems.includes(id),
    ),
  )
  const customIds = new Set(customGear.map((g) => g.id))
  const droppedCustom = uniqueStrings(
    (Array.isArray(raw.droppedCustom) ? raw.droppedCustom.map(String) : []).filter((id) =>
      customIds.has(id),
    ),
  )
  return {
    gear,
    smallItems,
    undefinedGear: typeof raw.undefinedGear === 'number' ? raw.undefinedGear : 0,
    undefinedSmall: typeof raw.undefinedSmall === 'number' ? raw.undefinedSmall : 0,
    writeIns: Array.isArray(raw.writeIns) ? raw.writeIns.map(String) : [],
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    gearLoadOverride:
      raw.gearLoadOverride && typeof raw.gearLoadOverride === 'object'
        ? Object.fromEntries(
            Object.entries(raw.gearLoadOverride).map(([k, v]) => [k, Number(v) || 0]),
          )
        : {},
    itemUsesMarked:
      raw.itemUsesMarked && typeof raw.itemUsesMarked === 'object'
        ? Object.fromEntries(
            Object.entries(raw.itemUsesMarked).map(([k, v]) => [k, Number(v) || 0]),
          )
        : {},
    itemUsesMaxOverride:
      raw.itemUsesMaxOverride && typeof raw.itemUsesMaxOverride === 'object'
        ? Object.fromEntries(
            Object.entries(raw.itemUsesMaxOverride).map(([k, v]) => {
              const n = Math.floor(Number(v) || 0)
              return [k, Math.min(10, Math.max(0, n))]
            }),
          )
        : {},
    prosperity:
      typeof raw.prosperity === 'number' && Number.isFinite(raw.prosperity)
        ? Math.floor(raw.prosperity)
        : 0,
    customGear,
    customOptions,
    droppedGear,
    droppedSmall,
    droppedCustom,
    loadBandId,
    loadBandsOverride: overrideBands?.length ? overrideBands : undefined,
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export function gearSlots(catalog: OutfitCatalog, name: string): number {
  return catalog.gear.find((g) => g.name === name)?.slots ?? 0
}

export function customGearById(state: InventoryState, id: string): CustomGearItem | undefined {
  return (state.customGear ?? []).find((g) => g.id === id)
}

export function customOptionById(
  state: InventoryState,
  id: string,
): CustomOutfitOption | undefined {
  return (state.customOptions ?? []).find((o) => o.id === id)
}

/** Printed slots for catalog name or custom id. */
export function printedSlotsFor(
  state: InventoryState,
  catalog: OutfitCatalog,
  key: string,
): number {
  const custom = customGearById(state, key)
  if (custom) return custom.slots
  const opt = customOptionById(state, key)
  if (opt) return opt.size === 'small' ? 0 : Math.max(0, opt.slots ?? 1)
  return gearSlots(catalog, key)
}

/** Load counted for a gear item after optional player override. */
export function effectiveGearSlots(
  state: InventoryState,
  catalog: OutfitCatalog,
  key: string,
): number {
  if ((state.droppedGear ?? []).includes(key) || (state.droppedCustom ?? []).includes(key)) {
    return 0
  }
  const printed = printedSlotsFor(state, catalog, key)
  const over = state.gearLoadOverride?.[key]
  if (typeof over === 'number') return clamp(over, 0, printed)
  return printed
}

/** Remaining uses for a kit item. Missing override = full (just taken). */
export function effectiveItemUses(
  state: InventoryState,
  key: string,
  max: number,
): number {
  if (max <= 0) return 0
  const over = state.itemUsesMarked?.[key]
  if (typeof over === 'number') return clamp(over, 0, max)
  return max
}

export const ITEM_USES_MAX_CAP = 10

/** Catalog / Prosperity default uses, or an explicit player override (0…10). */
export function effectiveItemUsesMax(
  state: InventoryState,
  key: string,
  catalogUses: string | number | null | undefined,
): number {
  const over = state.itemUsesMaxOverride?.[key]
  if (typeof over === 'number') return clamp(over, 0, ITEM_USES_MAX_CAP)
  return clamp(itemUsesMax(catalogUses, state.prosperity ?? 0), 0, ITEM_USES_MAX_CAP)
}

/** Set how many use circles an item tracks (0…10). */
export function setItemUsesMaxOverride(
  state: InventoryState,
  key: string,
  max: number,
  catalogUses?: string | number | null,
): InventoryState {
  const next = clamp(Math.floor(max), 0, ITEM_USES_MAX_CAP)
  const catalogDefault = clamp(
    itemUsesMax(catalogUses, state.prosperity ?? 0),
    0,
    ITEM_USES_MAX_CAP,
  )
  const overrides = { ...(state.itemUsesMaxOverride ?? {}) }
  if (next === catalogDefault) delete overrides[key]
  else overrides[key] = next

  let marked = { ...(state.itemUsesMarked ?? {}) }
  if (next <= 0) {
    delete marked[key]
  } else if (typeof marked[key] === 'number') {
    marked[key] = clamp(marked[key]!, 0, next)
  }

  return { ...state, itemUsesMaxOverride: overrides, itemUsesMarked: marked }
}

/** Mark remaining uses (tap-fill, same pattern as load / special possessions). */
export function setItemUsesMarked(
  state: InventoryState,
  key: string,
  marked: number,
  max: number,
): InventoryState {
  if (max <= 0) return state
  const next = clamp(marked, 0, max)
  const overrides = { ...(state.itemUsesMarked ?? {}) }
  if (next === max) delete overrides[key]
  else overrides[key] = next
  return { ...state, itemUsesMarked: overrides }
}

export function setProsperity(state: InventoryState, prosperity: number): InventoryState {
  return { ...state, prosperity: Math.floor(prosperity) }
}

function withoutItemUses(state: InventoryState, key: string): {
  itemUsesMarked: Record<string, number>
  itemUsesMaxOverride: Record<string, number>
} {
  const { [key]: _m, ...marked } = state.itemUsesMarked ?? {}
  const { [key]: _x, ...maxes } = state.itemUsesMaxOverride ?? {}
  return { itemUsesMarked: marked, itemUsesMaxOverride: maxes }
}

export function isGearDropped(state: InventoryState, name: string): boolean {
  return (state.droppedGear ?? []).includes(name)
}

export function isSmallDropped(state: InventoryState, name: string): boolean {
  return (state.droppedSmall ?? []).includes(name)
}

export function isCustomDropped(state: InventoryState, id: string): boolean {
  return (state.droppedCustom ?? []).includes(id)
}

export function gearLoad(state: InventoryState, catalog: OutfitCatalog): number {
  const fromCatalog = state.gear.reduce(
    (sum, name) => sum + effectiveGearSlots(state, catalog, name),
    0,
  )
  const fromCustom = (state.customGear ?? []).reduce(
    (sum, item) => sum + effectiveGearSlots(state, catalog, item.id),
    0,
  )
  return fromCatalog + fromCustom + state.undefinedGear
}

export function parseMarks(marks: string): [number, number] {
  const nums = marks.match(/\d+/g)?.map(Number) ?? []
  if (marks.includes('up to')) return [0, nums[0] ?? 0]
  if (nums.length >= 2) return [nums[0], nums[1]]
  return [nums[0] ?? 0, nums[0] ?? 0]
}

/** Active load band definitions (override or catalog). */
export function effectiveLoadBands(
  state: InventoryState,
  catalog: OutfitCatalog,
): OutfitLoadBand[] {
  if (state.loadBandsOverride?.length) return state.loadBandsOverride
  return catalog.outfit.loads
}

function bandIdFromName(name: string): LoadBandId | null {
  const n = name.toLowerCase()
  if (n.includes('light')) return 'light'
  if (n.includes('heavy')) return 'heavy'
  if (n.includes('normal')) return 'normal'
  return null
}

export function bandById(
  state: InventoryState,
  catalog: OutfitCatalog,
  id: LoadBandId,
): OutfitLoadBand | null {
  const bands = effectiveLoadBands(state, catalog)
  return bands.find((b) => bandIdFromName(b.name) === id) ?? bands[LOAD_BAND_IDS.indexOf(id)] ?? null
}

/** Band matching the computed load total (for info), not the declared selector. */
export function loadBand(
  load: number,
  catalog: OutfitCatalog,
  state?: InventoryState,
): OutfitLoadBand | null {
  const bands = state ? effectiveLoadBands(state, catalog) : catalog.outfit.loads
  for (const band of bands) {
    const [min, max] = parseMarks(band.marks)
    if (load >= min && load <= max) return band
  }
  return null
}

export function maxLoad(catalog: OutfitCatalog, state?: InventoryState): number {
  const bands = state ? effectiveLoadBands(state, catalog) : catalog.outfit.loads
  return Math.max(...bands.map((band) => parseMarks(band.marks)[1]), 0)
}

export function isOverloaded(state: InventoryState, catalog: OutfitCatalog): boolean {
  return gearLoad(state, catalog) > maxLoad(catalog, state)
}

export function declaredBandRange(
  state: InventoryState,
  catalog: OutfitCatalog,
): { id: LoadBandId; band: OutfitLoadBand; min: number; max: number } | null {
  const id = state.loadBandId ?? DEFAULT_LOAD_BAND_ID
  const band = bandById(state, catalog, id)
  if (!band) return null
  const [min, max] = parseMarks(band.marks)
  return { id, band, min, max }
}

/** Human reminder: declared band range vs current load. */
export function loadReminder(
  state: InventoryState,
  catalog: OutfitCatalog,
): {
  load: number
  bandId: LoadBandId
  label: string
  rangeText: string
  within: boolean
  overMax: boolean
  text: string
} {
  const load = gearLoad(state, catalog)
  const declared = declaredBandRange(state, catalog)
  const bandId = declared?.id ?? DEFAULT_LOAD_BAND_ID
  const label = LOAD_BAND_LABELS[bandId]
  const min = declared?.min ?? 0
  const max = declared?.max ?? maxLoad(catalog, state)
  const rangeText =
    min <= 0 || (declared?.band.marks.includes('up to') ?? false)
      ? `up to ${max} ◇`
      : `${min}–${max} ◇`
  const overMax = load > maxLoad(catalog, state)
  const within = load >= min && load <= max
  let text: string
  if (overMax) {
    text = `! Over max load (${maxLoad(catalog, state)} ◇) — drop something.`
  } else if (within) {
    text = `${label}: ${rangeText} · you are at ${load}`
  } else if (load < min) {
    text = `! ${label}: ${rangeText} · you are at ${load} (under this band)`
  } else {
    text = `! ${label}: ${rangeText} · you are at ${load} (over this band)`
  }
  return { load, bandId, label, rangeText, within, overMax, text }
}

/** Band id implied by the character's current counted load. */
export function loadBandIdForState(
  state: InventoryState,
  catalog: OutfitCatalog,
): LoadBandId {
  const load = gearLoad(state, catalog)
  const absoluteMax = maxLoad(catalog, state)
  if (load > absoluteMax) return 'heavy'
  const band = loadBand(load, catalog, state)
  if (!band) return load <= 0 ? 'light' : 'heavy'
  return bandIdFromName(band.name) ?? 'normal'
}

/**
 * After kit changes: if counted load crossed into another band, align the
 * declared selector. Manual overrides stick until the next crossing.
 */
export function alignDeclaredBandIfCrossed(
  before: InventoryState,
  after: InventoryState,
  catalog: OutfitCatalog,
): InventoryState {
  const prevId = loadBandIdForState(before, catalog)
  const nextId = loadBandIdForState(after, catalog)
  if (prevId === nextId) return after
  return setLoadBandId(after, nextId)
}

/** Set declared band to match current counted load (e.g. when Outfit closes). */
export function alignDeclaredBandToLoad(
  state: InventoryState,
  catalog: OutfitCatalog,
): InventoryState {
  const id = loadBandIdForState(state, catalog)
  if ((state.loadBandId ?? DEFAULT_LOAD_BAND_ID) === id) return state
  return setLoadBandId(state, id)
}

export function setLoadBandId(state: InventoryState, id: LoadBandId): InventoryState {
  return { ...state, loadBandId: id }
}

export function setLoadBandsOverride(
  state: InventoryState,
  bands: OutfitLoadBand[] | null,
): InventoryState {
  if (!bands?.length) {
    const { loadBandsOverride: _drop, ...rest } = state
    return { ...rest }
  }
  return { ...state, loadBandsOverride: bands }
}

export function defaultLoadBands(catalog: OutfitCatalog): OutfitLoadBand[] {
  return catalog.outfit.loads.map((b) => ({
    name: b.name,
    marks: b.marks,
    tags: b.tags ? [...b.tags] : undefined,
  }))
}

/** @deprecated Prefer takeGear / leaveGear. Toggle kept for tests/compat. */
export function toggleGear(state: InventoryState, name: string): InventoryState {
  if (state.gear.includes(name)) return leaveGear(state, name)
  return takeGear(state, name)
}

export function takeGear(state: InventoryState, name: string): InventoryState {
  if (state.gear.includes(name)) return state
  return {
    ...state,
    gear: [...state.gear, name],
    droppedGear: (state.droppedGear ?? []).filter((g) => g !== name),
  }
}

export function leaveGear(state: InventoryState, name: string): InventoryState {
  if (!state.gear.includes(name)) return state
  const { [name]: _drop, ...rest } = state.gearLoadOverride ?? {}
  return {
    ...state,
    gear: state.gear.filter((g) => g !== name),
    droppedGear: (state.droppedGear ?? []).filter((g) => g !== name),
    gearLoadOverride: rest,
    ...withoutItemUses(state, name),
  }
}

export function takeSmallItem(state: InventoryState, name: string): InventoryState {
  if (state.smallItems.includes(name)) return state
  return {
    ...state,
    smallItems: [...state.smallItems, name],
    droppedSmall: (state.droppedSmall ?? []).filter((g) => g !== name),
  }
}

export function leaveSmallItem(state: InventoryState, name: string): InventoryState {
  if (!state.smallItems.includes(name)) return state
  return {
    ...state,
    smallItems: state.smallItems.filter((s) => s !== name),
    droppedSmall: (state.droppedSmall ?? []).filter((s) => s !== name),
    ...withoutItemUses(state, name),
  }
}

export function takeCustomOption(state: InventoryState, optionId: string): InventoryState {
  const opt = customOptionById(state, optionId)
  if (!opt) return state
  if (opt.size === 'small') {
    return takeSmallItem(state, opt.id)
  }
  if ((state.customGear ?? []).some((g) => g.id === opt.id)) {
    return {
      ...state,
      droppedCustom: (state.droppedCustom ?? []).filter((id) => id !== opt.id),
    }
  }
  return {
    ...state,
    customGear: [
      ...(state.customGear ?? []),
      { id: opt.id, name: opt.name, slots: clamp(opt.slots ?? 1, 0, 8) },
    ],
    droppedCustom: (state.droppedCustom ?? []).filter((id) => id !== opt.id),
  }
}

export function leaveCustomOption(state: InventoryState, optionId: string): InventoryState {
  const opt = customOptionById(state, optionId)
  if (!opt) return state
  if (opt.size === 'small') return leaveSmallItem(state, optionId)
  const { [optionId]: _drop, ...rest } = state.gearLoadOverride ?? {}
  return {
    ...state,
    customGear: (state.customGear ?? []).filter((g) => g.id !== optionId),
    droppedCustom: (state.droppedCustom ?? []).filter((id) => id !== optionId),
    gearLoadOverride: rest,
    ...withoutItemUses(state, optionId),
  }
}

export function isCustomOptionTaken(state: InventoryState, optionId: string): boolean {
  const opt = customOptionById(state, optionId)
  if (!opt) return false
  if (opt.size === 'small') return state.smallItems.includes(optionId)
  return (state.customGear ?? []).some((g) => g.id === optionId)
}

export function dropGear(state: InventoryState, name: string): InventoryState {
  if (!state.gear.includes(name) || isGearDropped(state, name)) return state
  return { ...state, droppedGear: [...(state.droppedGear ?? []), name] }
}

export function pickGear(state: InventoryState, name: string): InventoryState {
  if (!state.gear.includes(name)) return state
  return { ...state, droppedGear: (state.droppedGear ?? []).filter((g) => g !== name) }
}

export function dropSmallItem(state: InventoryState, name: string): InventoryState {
  if (!state.smallItems.includes(name) || isSmallDropped(state, name)) return state
  return { ...state, droppedSmall: [...(state.droppedSmall ?? []), name] }
}

export function pickSmallItem(state: InventoryState, name: string): InventoryState {
  if (!state.smallItems.includes(name)) return state
  return { ...state, droppedSmall: (state.droppedSmall ?? []).filter((g) => g !== name) }
}

export function dropCustom(state: InventoryState, id: string): InventoryState {
  if (!(state.customGear ?? []).some((g) => g.id === id) || isCustomDropped(state, id)) return state
  return { ...state, droppedCustom: [...(state.droppedCustom ?? []), id] }
}

export function pickCustom(state: InventoryState, id: string): InventoryState {
  if (!(state.customGear ?? []).some((g) => g.id === id)) return state
  return { ...state, droppedCustom: (state.droppedCustom ?? []).filter((g) => g !== id) }
}

/** Set how many ◇ a carried item counts for (Armored shield → 1 of 2). */
export function setGearLoadOverride(
  state: InventoryState,
  catalog: OutfitCatalog,
  key: string,
  slots: number,
): InventoryState {
  const printed = printedSlotsFor(state, catalog, key)
  const next = clamp(slots, 0, printed)
  const overrides = { ...(state.gearLoadOverride ?? {}) }
  if (next === printed) delete overrides[key]
  else overrides[key] = next
  return { ...state, gearLoadOverride: overrides }
}

/** @deprecated Prefer takeSmallItem / leaveSmallItem. */
export function toggleSmallItem(state: InventoryState, name: string): InventoryState {
  if (state.smallItems.includes(name)) return leaveSmallItem(state, name)
  return takeSmallItem(state, name)
}

export function setUndefinedGear(
  state: InventoryState,
  n: number,
  catalog: OutfitCatalog,
): InventoryState {
  return { ...state, undefinedGear: clamp(n, 0, catalog.outfit.undefinedSlots) }
}

export function setUndefinedSmall(
  state: InventoryState,
  n: number,
  catalog: OutfitCatalog,
): InventoryState {
  return { ...state, undefinedSmall: clamp(n, 0, catalog.smallItems.undefinedSlots) }
}

/** Have What You Need: spend undefined ◇ to mark a named gear item. */
export function assignUndefinedGear(
  state: InventoryState,
  catalog: OutfitCatalog,
  name: string,
): InventoryState {
  if (state.gear.includes(name)) return state
  const cost = gearSlots(catalog, name)
  if (state.undefinedGear < cost) return state
  return takeGear(
    { ...state, undefinedGear: state.undefinedGear - cost },
    name,
  )
}

export function assignUndefinedSmall(state: InventoryState, name: string): InventoryState {
  if (state.smallItems.includes(name) || state.undefinedSmall <= 0) return state
  return takeSmallItem({ ...state, undefinedSmall: state.undefinedSmall - 1 }, name)
}

export function setWriteIn(state: InventoryState, index: number, value: string): InventoryState {
  const writeIns = [...(state.writeIns ?? [])]
  while (writeIns.length <= index) writeIns.push('')
  writeIns[index] = value
  return { ...state, writeIns }
}

export function addCustomOption(
  state: InventoryState,
  opts: { name: string; size: 'small' | 'big'; slots?: number; take?: boolean },
): InventoryState {
  const id = newId()
  const name = opts.name.trim() || 'Custom item'
  const option: CustomOutfitOption = {
    id,
    name,
    size: opts.size,
    slots: opts.size === 'big' ? clamp(opts.slots ?? 1, 0, 8) : undefined,
  }
  let next: InventoryState = {
    ...state,
    customOptions: [...(state.customOptions ?? []), option],
  }
  if (opts.take !== false) next = takeCustomOption(next, id)
  return next
}

/** @deprecated Prefer addCustomOption. */
export function addCustomGear(
  state: InventoryState,
  item: Omit<CustomGearItem, 'id'> & { id?: string },
): InventoryState {
  const id = item.id ?? newId()
  const name = item.name.trim() || 'Custom item'
  const slots = clamp(item.slots, 0, 8)
  let next: InventoryState = {
    ...state,
    customOptions: [
      ...(state.customOptions ?? []),
      { id, name, size: 'big', slots },
    ],
  }
  next = {
    ...next,
    customGear: [
      ...(next.customGear ?? []),
      { id, name, slots, tags: item.tags, text: item.text, armor: item.armor },
    ],
  }
  return next
}

export function updateCustomGear(
  state: InventoryState,
  id: string,
  patch: Partial<Omit<CustomGearItem, 'id'>>,
): InventoryState {
  return {
    ...state,
    customGear: (state.customGear ?? []).map((g) =>
      g.id === id
        ? {
            ...g,
            ...patch,
            name: patch.name !== undefined ? patch.name.trim() || g.name : g.name,
            slots: patch.slots !== undefined ? clamp(patch.slots, 0, 8) : g.slots,
          }
        : g,
    ),
    customOptions: (state.customOptions ?? []).map((o) =>
      o.id === id
        ? {
            ...o,
            name: patch.name !== undefined ? patch.name.trim() || o.name : o.name,
            slots:
              o.size === 'big' && patch.slots !== undefined
                ? clamp(patch.slots, 0, 8)
                : o.slots,
          }
        : o,
    ),
  }
}

export function removeCustomGear(state: InventoryState, id: string): InventoryState {
  const { [id]: _drop, ...rest } = state.gearLoadOverride ?? {}
  return {
    ...state,
    customGear: (state.customGear ?? []).filter((g) => g.id !== id),
    droppedCustom: (state.droppedCustom ?? []).filter((g) => g !== id),
    gearLoadOverride: rest,
    ...withoutItemUses(state, id),
  }
}

/** Clear expedition kit + undefined pools; keep permanent customOptions and load band. */
export function resetOutfitKit(state: InventoryState): InventoryState {
  return {
    ...state,
    gear: [],
    smallItems: [],
    customGear: [],
    droppedGear: [],
    droppedSmall: [],
    droppedCustom: [],
    undefinedGear: 0,
    undefinedSmall: 0,
    gearLoadOverride: {},
    itemUsesMarked: {},
    itemUsesMaxOverride: {},
  }
}
