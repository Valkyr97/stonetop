<script lang="ts">
  import { OUTFIT_CATALOG } from '../../content/inventoryOutfit'
  import {
    addCustomOption,
    alignDeclaredBandToLoad,
    gearSlots,
    isCustomOptionTaken,
    itemBlurb,
    itemUsesLabel,
    leaveCustomOption,
    leaveGear,
    leaveSmallItem,
    loadBandProgress,
    readInventory,
    resetOutfitKit,
    setUndefinedGear,
    setUndefinedSmall,
    takeCustomOption,
    takeGear,
    takeSmallItem,
    type InventoryState,
  } from '../engine/inventory'

  interface Props {
    data: unknown
    readonly?: boolean
    open: boolean
    onclose: () => void
    onchange: (next: InventoryState) => void
  }

  let { data, readonly = false, open = false, onclose, onchange }: Props = $props()

  const catalog = OUTFIT_CATALOG
  const state = $derived(readInventory(data))
  const progress = $derived(loadBandProgress(state, catalog))
  const smallOptions = $derived(catalog.smallItems.options.filter((o) => o.name))

  let customOpen = $state(false)
  let customName = $state('')
  let customSize = $state<'small' | 'big'>('big')
  let customSlots = $state(1)

  function emit(next: InventoryState) {
    if (readonly) return
    onchange(next)
  }

  function close() {
    if (!readonly) {
      const aligned = alignDeclaredBandToLoad(state, catalog)
      if ((aligned.loadBandId ?? 'light') !== (state.loadBandId ?? 'light')) {
        onchange(aligned)
      }
    }
    onclose()
  }

  function addCustom() {
    if (!customName.trim()) return
    emit(
      addCustomOption(state, {
        name: customName,
        size: customSize,
        slots: customSize === 'big' ? Number(customSlots) || 1 : undefined,
        take: true,
      }),
    )
    customName = ''
    customSize = 'big'
    customSlots = 1
    customOpen = false
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) close()
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="backdrop" role="presentation" onclick={onBackdrop} onkeydown={onKey}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="outfit-title" tabindex="-1">
      <header class="head">
        <div class="head-main">
          <h2 id="outfit-title">Outfit</h2>
          <div class="load-sticky" class:over={progress.overMax} role="status">
            <span class="load-weight">{progress.text}</span>
            {#if progress.overMax}
              <span class="load-note">Drop something</span>
            {/if}
          </div>
        </div>
        <div class="head-actions">
          <button
            type="button"
            class="act danger"
            disabled={readonly}
            onclick={() => emit(resetOutfitKit(state))}
          >
            Reset
          </button>
          <button type="button" class="act" onclick={close}>Close</button>
        </div>
      </header>

      <div class="body">
        <section class="add-custom">
          {#if !customOpen}
            <button
              type="button"
              class="act primary"
              disabled={readonly}
              onclick={() => (customOpen = true)}
            >
              Add custom
            </button>
          {:else}
            <div class="custom-form">
              <input
                type="text"
                placeholder="Item name"
                disabled={readonly}
                bind:value={customName}
              />
              <div class="size-picks" role="group" aria-label="Item size">
                <button
                  type="button"
                  class="band-pick"
                  class:on={customSize === 'small'}
                  disabled={readonly}
                  onclick={() => (customSize = 'small')}
                >
                  Small
                </button>
                <button
                  type="button"
                  class="band-pick"
                  class:on={customSize === 'big'}
                  disabled={readonly}
                  onclick={() => (customSize = 'big')}
                >
                  Big
                </button>
              </div>
              {#if customSize === 'big'}
                <label class="slots-pick">
                  ◇
                  <input type="number" min="0" max="4" disabled={readonly} bind:value={customSlots} />
                </label>
              {/if}
              <button
                type="button"
                class="act primary"
                disabled={readonly || !customName.trim()}
                onclick={addCustom}
              >
                Save
              </button>
              <button type="button" class="act" onclick={() => (customOpen = false)}>Cancel</button>
            </div>
          {/if}
        </section>

        <section class="block">
          <h3>Undefined ◇</h3>
          <p class="hint">{catalog.outfit.undefinedText}</p>
          <div class="undef-row">
            <div class="boxes" role="group" aria-label="Undefined load">
              {#each Array(catalog.outfit.undefinedSlots) as _, i}
                <span class="box" class:on={i < state.undefinedGear} aria-hidden="true"></span>
              {/each}
            </div>
            <div class="item-actions">
              <button
                type="button"
                class="act"
                disabled={readonly || state.undefinedGear <= 0}
                onclick={() => emit(setUndefinedGear(state, state.undefinedGear - 1, catalog))}
              >−</button>
              <span class="count">{state.undefinedGear}</span>
              <button
                type="button"
                class="act"
                disabled={readonly || state.undefinedGear >= catalog.outfit.undefinedSlots}
                onclick={() => emit(setUndefinedGear(state, state.undefinedGear + 1, catalog))}
              >+</button>
            </div>
          </div>
        </section>

        <section class="block">
          <h3>Undefined small items</h3>
          <p class="hint">{catalog.smallItems.undefinedText}</p>
          <div class="undef-row">
            <div class="boxes" role="group" aria-label="Undefined small items">
              {#each Array(catalog.smallItems.undefinedSlots) as _, i}
                <span class="box" class:on={i < state.undefinedSmall} aria-hidden="true"></span>
              {/each}
            </div>
            <div class="item-actions">
              <button
                type="button"
                class="act"
                disabled={readonly || state.undefinedSmall <= 0}
                onclick={() => emit(setUndefinedSmall(state, state.undefinedSmall - 1, catalog))}
              >−</button>
              <span class="count">{state.undefinedSmall}</span>
              <button
                type="button"
                class="act"
                disabled={readonly || state.undefinedSmall >= catalog.smallItems.undefinedSlots}
                onclick={() => emit(setUndefinedSmall(state, state.undefinedSmall + 1, catalog))}
              >+</button>
            </div>
          </div>
        </section>

        <section class="block">
          <h3>Gear</h3>
          <ul class="list">
            {#each catalog.gear as item}
              {@const taken = state.gear.includes(item.name)}
              {@const blurb = itemBlurb(item)}
              {@const uses = itemUsesLabel(item)}
              {@const slots = gearSlots(catalog, item.name)}
              <li class="row" class:on={taken}>
                <div class="info">
                  <div class="title-row">
                    {#if slots > 0}
                      <span class="slots">{'◇'.repeat(slots)}</span>
                    {/if}
                    <span class="name">{item.name}</span>
                    {#if uses}
                      <span class="uses">{uses}</span>
                    {/if}
                  </div>
                  {#if blurb}
                    <span class="desc">{blurb}</span>
                  {/if}
                </div>
                {#if taken}
                  <button
                    type="button"
                    class="act"
                    disabled={readonly}
                    onclick={() => emit(leaveGear(state, item.name))}
                  >
                    Leave
                  </button>
                {:else}
                  <button
                    type="button"
                    class="act primary"
                    disabled={readonly}
                    onclick={() => emit(takeGear(state, item.name))}
                  >
                    Take
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        </section>

        <section class="block">
          <h3>Small items</h3>
          <ul class="list">
            {#each smallOptions as item}
              {@const taken = state.smallItems.includes(item.name)}
              {@const blurb = itemBlurb(item)}
              {@const uses = itemUsesLabel(item)}
              <li class="row" class:on={taken}>
                <div class="info">
                  <div class="title-row">
                    <span class="name">{item.name}</span>
                    {#if uses}
                      <span class="uses">{uses}</span>
                    {/if}
                  </div>
                  {#if blurb}
                    <span class="desc">{blurb}</span>
                  {/if}
                </div>
                {#if taken}
                  <button
                    type="button"
                    class="act"
                    disabled={readonly}
                    onclick={() => emit(leaveSmallItem(state, item.name))}
                  >
                    Leave
                  </button>
                {:else}
                  <button
                    type="button"
                    class="act primary"
                    disabled={readonly}
                    onclick={() => emit(takeSmallItem(state, item.name))}
                  >
                    Take
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        </section>

        {#if (state.customOptions ?? []).length}
          <section class="block">
            <h3>Your custom options</h3>
            <ul class="list">
              {#each state.customOptions ?? [] as opt}
                {@const taken = isCustomOptionTaken(state, opt.id)}
                <li class="row" class:on={taken}>
                  <div class="info">
                    <div class="title-row">
                      {#if opt.size !== 'small' && (opt.slots ?? 1) > 0}
                        <span class="slots">{'◇'.repeat(opt.slots ?? 1)}</span>
                      {/if}
                      <span class="name">{opt.name}</span>
                      {#if opt.size === 'small'}
                        <span class="uses">small</span>
                      {/if}
                    </div>
                  </div>
                  {#if taken}
                    <button
                      type="button"
                      class="act"
                      disabled={readonly}
                      onclick={() => emit(leaveCustomOption(state, opt.id))}
                    >
                      Leave
                    </button>
                  {:else}
                    <button
                      type="button"
                      class="act primary"
                      disabled={readonly}
                      onclick={() => emit(takeCustomOption(state, opt.id))}
                    >
                      Take
                    </button>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: color-mix(in srgb, var(--ink) 45%, transparent);
    display: grid;
    place-items: center;
    padding: 1rem;
  }
  .modal {
    width: min(40rem, 100%);
    max-height: min(90vh, 52rem);
    display: flex;
    flex-direction: column;
    background: var(--paper);
    color: var(--ink);
    border-radius: var(--radius);
    border: 1px solid var(--line);
    box-shadow: 0 12px 40px color-mix(in srgb, var(--ink) 25%, transparent);
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--paper);
    flex-shrink: 0;
  }
  .head-main {
    display: grid;
    gap: 0.45rem;
    min-width: 0;
    flex: 1;
  }
  .head h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 400;
  }
  .load-sticky {
    display: grid;
    gap: 0.1rem;
    padding: 0.45rem 0.55rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--paper-2) 88%, var(--accent));
  }
  .load-sticky.over {
    border-color: var(--danger);
    background: color-mix(in srgb, var(--paper-2) 88%, var(--danger));
  }
  .load-weight {
    font-size: 1.1rem;
    font-weight: 700;
  }
  .load-sticky.over .load-weight,
  .load-sticky.over .load-note {
    color: var(--danger);
  }
  .load-band {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-muted);
  }
  .load-note {
    font-size: 0.78rem;
    color: var(--ink-muted);
  }
  .head-actions {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
  }
  .reminder {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-muted);
  }
  .reminder.over {
    color: var(--danger);
  }
  .body {
    overflow: auto;
    padding: 0.85rem 1rem 1.2rem;
    display: grid;
    gap: 1rem;
  }
  .block {
    display: grid;
    gap: 0.45rem;
  }
  h3 {
    margin: 0;
    font-size: 0.95rem;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
  .row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    justify-content: space-between;
    padding: 0.45rem 0.55rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper-2);
  }
  .row.on {
    border-color: var(--accent);
    background: var(--selected-bg);
  }
  .info {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
    flex: 1;
  }
  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem 0.55rem;
  }
  .name {
    font-weight: 600;
    font-size: 0.88rem;
    line-height: 1.25;
  }
  .slots {
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
  }
  .uses {
    font-size: 0.78rem;
    color: var(--ink-muted);
  }
  .meta {
    font-size: 0.78rem;
    color: var(--ink-muted);
  }
  .desc {
    font-size: 0.78rem;
    line-height: 1.35;
    color: var(--ink-muted);
  }
  .row .act {
    flex-shrink: 0;
    align-self: center;
  }
  .act {
    min-height: var(--btn-min);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    padding: var(--btn-pad-y) var(--btn-pad-x);
    cursor: pointer;
    white-space: nowrap;
  }
  .act:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .act.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-contrast);
  }
  .act.danger {
    border-color: color-mix(in srgb, var(--danger) 45%, var(--line));
    color: var(--danger);
  }
  .custom-form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .custom-form input[type='text'] {
    flex: 1;
    min-width: 8rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    padding: 0.4rem 0.55rem;
    font: inherit;
  }
  .size-picks {
    display: flex;
    gap: 0.3rem;
  }
  .band-pick {
    border: 1px solid var(--line);
    background: var(--paper-2);
    color: var(--ink);
    border-radius: 999px;
    padding: 0.35rem 0.7rem;
    font: inherit;
    cursor: pointer;
  }
  .band-pick.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .slots-pick {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.85rem;
    color: var(--ink-muted);
  }
  .slots-pick input {
    width: 3rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    padding: 0.35rem;
    font: inherit;
  }
  .hint {
    margin: 0;
    font-size: 0.82rem;
    color: var(--ink-muted);
  }
  .undef-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.55rem;
  }
  .boxes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    padding: 0.15rem 0;
  }
  /* Weight / load: diamond (◇) marks */
  .box {
    width: 0.78rem;
    height: 0.78rem;
    border: 1.5px solid var(--line);
    border-radius: 1px;
    background: var(--paper);
    display: inline-block;
    box-sizing: border-box;
    transform: rotate(45deg);
    flex-shrink: 0;
  }
  .box.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  .item-actions {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }
  .count {
    min-width: 1.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
</style>
