<script lang="ts">
  import { OUTFIT_CATALOG } from '../../content/inventoryOutfit'
  import {
    assignUndefinedGear,
    assignUndefinedSmall,
    alignDeclaredBandIfCrossed,
    catalogGear,
    catalogSmallItem,
    customOptionById,
    defaultLoadBands,
    dropCustom,
    dropGear,
    dropSmallItem,
    effectiveGearSlots,
    effectiveItemUses,
    effectiveItemUsesMax,
    gearLoad,
    gearSlots,
    isCustomDropped,
    isGearDropped,
    isSmallDropped,
    itemBlurb,
    LOAD_BAND_IDS,
    LOAD_BAND_LABELS,
    loadBandProgress,
    loadReminder,
    maxLoad,
    pickCustom,
    pickGear,
    pickSmallItem,
    readInventory,
    setGearLoadOverride,
    setItemUsesMarked,
    setItemUsesMaxOverride,
    setLoadBandId,
    setLoadBandsOverride,
    setProsperity,
    type InventoryState,
    type OutfitLoadBand,
  } from '../engine/inventory'
  import OutfitModal from './OutfitModal.svelte'
  import InventoryBand from './InventoryBand.svelte'
  import InventoryItemRow from './InventoryItemRow.svelte'

  interface Props {
    data: unknown
    readonly?: boolean
    mode?: 'play' | 'edit'
    /** When true, show only the load band selector + Outfit opener (Sheet front). */
    bandOnly?: boolean
    onchange: (next: InventoryState) => void
  }

  let { data, readonly = false, mode = 'play', bandOnly = false, onchange }: Props = $props()
  const usesMaxEditable = $derived(mode === 'edit' && !readonly)

  const catalog = OUTFIT_CATALOG
  const inv = $derived(readInventory(data))
  const load = $derived(gearLoad(inv, catalog))
  const reminder = $derived(loadReminder(inv, catalog))
  const progress = $derived(loadBandProgress(inv, catalog))
  const overloaded = $derived(progress.overMax)
  const max = $derived(maxLoad(catalog, inv))

  const kitGear = $derived(
    inv.gear.map((name) => ({
      key: name,
      name,
      kind: 'gear' as const,
      printed: gearSlots(catalog, name),
      dropped: isGearDropped(inv, name),
    })),
  )
  const kitSmall = $derived(
    inv.smallItems.map((key) => {
      const opt = customOptionById(inv, key)
      const catalogSmall = catalog.smallItems.options.find((o) => o.name === key)
      return {
        key,
        name: opt?.name ?? catalogSmall?.name ?? key,
        kind: 'small' as const,
        dropped: isSmallDropped(inv, key),
      }
    }),
  )
  const kitCustom = $derived(
    (inv.customGear ?? []).map((item) => ({
      key: item.id,
      name: item.name,
      kind: 'custom' as const,
      printed: item.slots,
      dropped: isCustomDropped(inv, item.id),
    })),
  )

  let outfitOpen = $state(false)
  let advancedOpen = $state(false)
  /** Item key whose load boxes are currently editable (tap to mark/clear). */
  let editingLoadKey = $state<string | null>(null)

  function emit(next: InventoryState) {
    if (readonly) return
    onchange(next)
  }

  /** Kit / load changes: auto-align declared band only when counted load crosses a threshold. */
  function emitLoadChange(next: InventoryState) {
    if (readonly) return
    onchange(alignDeclaredBandIfCrossed(inv, next, catalog))
  }

  function closeOutfit() {
    outfitOpen = false
  }

  function draftBands(): OutfitLoadBand[] {
    return (inv.loadBandsOverride ?? defaultLoadBands(catalog)).map((b) => ({
      name: b.name,
      marks: b.marks,
      tags: b.tags ? [...b.tags] : undefined,
    }))
  }

  function setBandMarks(index: number, marks: string) {
    const bands = draftBands()
    if (!bands[index]) return
    bands[index] = { ...bands[index], marks }
    emit(setLoadBandsOverride(inv, bands))
  }

  function toggleLoadEdit(key: string) {
    if (readonly) return
    editingLoadKey = editingLoadKey === key ? null : key
  }

  function markItemLoad(key: string, printed: number, boxIndex: number, current: number) {
    if (readonly || editingLoadKey !== key) return
    const next = boxIndex < current ? boxIndex : boxIndex + 1
    emitLoadChange(setGearLoadOverride(inv, catalog, key, Math.max(0, Math.min(printed, next))))
  }

  function markItemUses(key: string, max: number, boxIndex: number, current: number) {
    if (readonly || max <= 0) return
    const next = boxIndex < current ? boxIndex : boxIndex + 1
    emit(setItemUsesMarked(inv, key, next, max))
  }

  function setUsesMax(
    key: string,
    value: number,
    catalogUses?: string | number | null,
  ) {
    if (readonly) return
    emit(setItemUsesMaxOverride(inv, key, value, catalogUses))
  }
</script>

{#if bandOnly}
  <InventoryBand
    state={inv}
    {reminder}
    {readonly}
    bands={draftBands()}
    onchange={emit}
    onOpenOutfit={() => (outfitOpen = true)}
    onSetBandMarks={setBandMarks}
  />
{:else}
  <div class="inv">
    <header class="inv-head">
      <h2>Inventory</h2>
      <button
        type="button"
        class="outfit-btn"
        disabled={readonly}
        onclick={() => (outfitOpen = true)}
      >
        Outfit
      </button>
    </header>

    <div class="load-sticky" class:over={overloaded} role="status">
      <span class="load-weight">{progress.text}</span>
      {#if overloaded}
        <span class="load-note">Drop something — max is {max} ◇</span>
      {/if}
    </div>

    <p class="lede">
      What you took in Outfit. Drop to leave something off your load (it stays listed); Pick to carry it again.
    </p>

    {#if overloaded}
      <p class="warn">! Overloaded — carrying {load} of a maximum {max}. Drop something.</p>
    {/if}

    <details class="advanced" bind:open={advancedOpen}>
      <summary>Advanced load</summary>
      <p class="hint">Declared band vs counted ◇ (Pack Horse / house thresholds).</p>
      <div class="band-picks" role="group" aria-label="Declared load">
        {#each LOAD_BAND_IDS as id}
          <button
            type="button"
            class="band-pick"
            class:on={(inv.loadBandId ?? 'light') === id}
            aria-pressed={(inv.loadBandId ?? 'light') === id}
            disabled={readonly}
            onclick={() => emit(setLoadBandId(inv, id))}
          >
            {LOAD_BAND_LABELS[id]}
          </button>
        {/each}
      </div>
      <div class="thresholds">
        {#each draftBands() as band, i}
          <label class="thresh-row">
            <span>{band.name}</span>
            <input
              type="text"
              disabled={readonly}
              value={band.marks}
              placeholder="e.g. 4-6 or up to 4"
              oninput={(e) => setBandMarks(i, e.currentTarget.value)}
            />
          </label>
        {/each}
        <label class="thresh-row">
          <span>Prosperity</span>
          <input
            type="number"
            disabled={readonly}
            value={inv.prosperity ?? 0}
            step="1"
            oninput={(e) => emit(setProsperity(inv, Number(e.currentTarget.value) || 0))}
          />
        </label>
        <button
          type="button"
          class="linkish"
          disabled={readonly}
          onclick={() => emit(setLoadBandsOverride(inv, null))}
        >
          Reset to book defaults
        </button>
      </div>
    </details>

    <section class="block">
      <h3>On you</h3>
      {#if !kitGear.length && !kitSmall.length && !kitCustom.length}
        <p class="hint">Nothing taken yet — open Outfit to choose gear.</p>
      {:else}
        <ul class="gear-list">
          {#each kitGear as item}
            {@const effective = effectiveGearSlots(inv, catalog, item.key)}
            {@const def = catalogGear(catalog, item.name)}
            {@const usesMax = effectiveItemUsesMax(inv, item.key, def?.uses)}
            {@const usesMarked = effectiveItemUses(inv, item.key, usesMax)}
            <InventoryItemRow
              name={item.name}
              dropped={item.dropped}
              editing={editingLoadKey === item.key}
              {readonly}
              printed={item.printed}
              {effective}
              blurb={itemBlurb(def)}
              {usesMax}
              {usesMarked}
              {usesMaxEditable}
              onMarkUses={(i) => markItemUses(item.key, usesMax, i, usesMarked)}
              onMarkLoad={(i) => markItemLoad(item.key, item.printed, i, effective)}
              onToggleEdit={() => toggleLoadEdit(item.key)}
              onSetUsesMax={(n) => setUsesMax(item.key, n, def?.uses)}
              onPick={() => emitLoadChange(pickGear(inv, item.key))}
              onDrop={() => {
                editingLoadKey = null
                emitLoadChange(dropGear(inv, item.key))
              }}
            />
          {/each}

          {#each kitCustom as item}
            {@const effective = effectiveGearSlots(inv, catalog, item.key)}
            {@const custom = (inv.customGear ?? []).find((g) => g.id === item.key)}
            {@const usesMax = effectiveItemUsesMax(inv, item.key, undefined)}
            {@const usesMarked = effectiveItemUses(inv, item.key, usesMax)}
            <InventoryItemRow
              name={item.name}
              dropped={item.dropped}
              editing={editingLoadKey === item.key}
              {readonly}
              printed={item.printed}
              {effective}
              badge="custom"
              blurb={itemBlurb(custom)}
              {usesMax}
              {usesMarked}
              {usesMaxEditable}
              onMarkUses={(i) => markItemUses(item.key, usesMax, i, usesMarked)}
              onMarkLoad={(i) => markItemLoad(item.key, item.printed, i, effective)}
              onToggleEdit={() => toggleLoadEdit(item.key)}
              onSetUsesMax={(n) => setUsesMax(item.key, n)}
              onPick={() => emitLoadChange(pickCustom(inv, item.key))}
              onDrop={() => {
                editingLoadKey = null
                emitLoadChange(dropCustom(inv, item.key))
              }}
            />
          {/each}

          {#each kitSmall as item}
            {@const def = catalogSmallItem(catalog, item.name) ?? customOptionById(inv, item.key)}
            {@const catalogUses = def && 'uses' in def ? def.uses : undefined}
            {@const usesMax = effectiveItemUsesMax(inv, item.key, catalogUses)}
            {@const usesMarked = effectiveItemUses(inv, item.key, usesMax)}
            <InventoryItemRow
              name={item.name}
              compact
              dropped={item.dropped}
              editing={editingLoadKey === item.key}
              {readonly}
              badge="small"
              blurb={itemBlurb(def)}
              {usesMax}
              {usesMarked}
              {usesMaxEditable}
              onMarkUses={(i) => markItemUses(item.key, usesMax, i, usesMarked)}
              onToggleEdit={() => toggleLoadEdit(item.key)}
              onSetUsesMax={(n) => setUsesMax(item.key, n, catalogUses)}
              onPick={() => emitLoadChange(pickSmallItem(inv, item.key))}
              onDrop={() => {
                editingLoadKey = null
                emitLoadChange(dropSmallItem(inv, item.key))
              }}
            />
          {/each}
        </ul>
      {/if}

      <div class="undefined">
        <p class="sub">Undefined ◇</p>
        <p class="hint">Set in Outfit. Spend here when you Have What You Need.</p>
        <div class="undef-row">
          <div class="boxes" role="group" aria-label="Undefined load">
            {#each Array(catalog.outfit.undefinedSlots) as _, i}
              <span class="box static" class:on={i < inv.undefinedGear} aria-hidden="true"></span>
            {/each}
          </div>
          <span class="count">{inv.undefinedGear}</span>
        </div>
        {#if inv.undefinedGear > 0 && !readonly}
          <details class="spend-fold">
            <summary>Spend undefined on catalog gear</summary>
            <ul class="spend-list">
              {#each catalog.gear.filter((g) => !inv.gear.includes(g.name) && inv.undefinedGear >= g.slots) as item}
                <li>
                  <span>{item.name} ({item.slots} ◇)</span>
                  <button
                    type="button"
                    class="act"
                    onclick={() => emitLoadChange(assignUndefinedGear(inv, catalog, item.name))}
                  >Spend</button>
                </li>
              {/each}
            </ul>
          </details>
        {/if}
      </div>

      <div class="undefined">
        <p class="sub">Undefined small items</p>
        <p class="hint">Set in Outfit.</p>
        <div class="undef-row">
          <div class="boxes" role="group" aria-label="Undefined small items">
            {#each Array(catalog.smallItems.undefinedSlots) as _, i}
              <span class="box static" class:on={i < inv.undefinedSmall} aria-hidden="true"></span>
            {/each}
          </div>
          <span class="count">{inv.undefinedSmall}</span>
        </div>
        {#if inv.undefinedSmall > 0 && !readonly}
          <details class="spend-fold">
            <summary>Spend undefined on a small item</summary>
            <ul class="spend-list">
              {#each catalog.smallItems.options.filter((o) => o.name && !inv.smallItems.includes(o.name)) as item}
                <li>
                  <span>{item.name}</span>
                  <button
                    type="button"
                    class="act"
                    onclick={() => emitLoadChange(assignUndefinedSmall(inv, item.name))}
                  >Spend</button>
                </li>
              {/each}
            </ul>
          </details>
        {/if}
      </div>
    </section>

    <label class="notes">
      <span class="sub">Notes</span>
      <textarea
        rows="3"
        disabled={readonly}
        value={inv.notes ?? ''}
        oninput={(e) => emit({ ...inv, notes: e.currentTarget.value })}
      ></textarea>
    </label>
  </div>
{/if}

<OutfitModal
  {data}
  {readonly}
  open={outfitOpen}
  onclose={closeOutfit}
  onchange={onchange}
/>

<style>
  .inv { display: grid; gap: 1rem; }
  .inv-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .load-sticky {
    position: sticky;
    top: var(--play-tabs-h, 2.75rem);
    z-index: 6;
    display: grid;
    gap: 0.15rem;
    padding: 0.65rem 0.75rem;
    margin: 0 -0.15rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--selected-bg);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--ink) 8%, transparent);
  }
  .load-sticky.over {
    border-color: var(--danger);
    background: color-mix(in srgb, var(--paper) 88%, var(--danger));
  }
  .load-weight { font-size: 1.15rem; font-weight: 700; letter-spacing: 0.01em; }
  .load-sticky.over .load-weight,
  .load-sticky.over .load-note { color: var(--danger); }
  .load-note { font-size: 0.8rem; color: var(--ink-muted); }
  h2 { margin: 0; font-family: var(--font-display); font-weight: 400; }
  h3 { margin: 0 0 0.45rem; font-size: 1rem; }
  .outfit-btn {
    border: 1px solid var(--accent); background: var(--accent); color: var(--accent-contrast);
    border-radius: var(--radius); padding: 0.45rem 0.85rem; font: inherit; font-weight: 600; cursor: pointer;
  }
  .outfit-btn:disabled { opacity: 0.45; cursor: default; }
  .hint, .lede { color: var(--ink-muted); font-size: 0.85rem; }
  .lede { margin: 0; }
  .warn {
    margin: 0; padding: 0.55rem 0.75rem; border: 1px solid var(--danger); border-radius: var(--radius);
    background: color-mix(in srgb, var(--danger) 10%, var(--paper)); color: var(--danger); font-size: 0.88rem;
  }
  .block { display: grid; gap: 0.55rem; }
  .act {
    min-height: var(--btn-min); border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper);
    color: var(--ink); font: inherit; font-size: var(--text-sm); font-weight: 600;
    padding: var(--btn-pad-y) var(--btn-pad-x);
    cursor: pointer; touch-action: manipulation; white-space: nowrap;
  }
  .count { min-width: 1.5rem; text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; }
  .gear-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
  .undefined { display: grid; gap: 0.35rem; margin-top: 0.35rem; }
  .undef-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.55rem; }
  .sub { margin: 0; font-weight: 600; font-size: 0.88rem; }
  .boxes { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; padding: 0.15rem 0; }
  .box {
    width: 0.78rem; height: 0.78rem; border: 1.5px solid var(--line); border-radius: 1px; background: var(--paper);
    padding: 0; display: inline-block; box-sizing: border-box; transform: rotate(45deg); flex-shrink: 0;
  }
  .box.static { pointer-events: none; }
  .box.on { background: var(--accent); border-color: var(--accent); }
  .notes { display: grid; gap: 0.35rem; }
  .notes textarea, .thresh-row input {
    box-sizing: border-box; border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--paper); color: var(--ink); padding: 0.45rem 0.6rem; font: inherit;
  }
  .band-picks { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .band-pick {
    border: 1px solid var(--line); background: var(--paper-2); color: var(--ink); border-radius: 999px;
    padding: var(--btn-pad-y) 0.7rem; font: inherit; font-size: var(--text-sm); cursor: pointer;
    min-height: var(--btn-min);
  }
  .band-pick.on {
    border-color: var(--accent); background: var(--selected-bg);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .linkish {
    border: 0; background: none; color: var(--accent); font: inherit; font-size: 0.85rem;
    text-decoration: underline; text-underline-offset: 2px; cursor: pointer; padding: 0; justify-self: start;
  }
  .advanced {
    border: 1px solid var(--line); border-radius: var(--radius); padding: 0.55rem 0.75rem; background: var(--paper-2);
  }
  .advanced summary { cursor: pointer; font-weight: 600; font-size: 0.9rem; color: var(--accent); min-height: 2rem; }
  .advanced .hint { margin: 0.45rem 0; }
  .thresholds { display: grid; gap: 0.45rem; margin-top: 0.55rem; }
  .thresh-row { display: grid; grid-template-columns: 7rem 1fr; gap: 0.5rem; align-items: center; font-size: 0.88rem; }
  .spend-fold { margin-top: 0.25rem; }
  .spend-fold summary { cursor: pointer; font-size: 0.82rem; color: var(--accent); }
  .spend-list { list-style: none; margin: 0.4rem 0 0; padding: 0; display: grid; gap: 0.3rem; }
  .spend-list li { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
</style>
