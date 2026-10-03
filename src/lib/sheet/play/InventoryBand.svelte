<script lang="ts">
  import {
    LOAD_BAND_IDS,
    LOAD_BAND_LABELS,
    setLoadBandId,
    setLoadBandsOverride,
    type InventoryState,
    type OutfitLoadBand,
  } from '../engine/inventory'

  interface Props {
    state: InventoryState
    reminder: { text: string; within: boolean; overMax: boolean }
    readonly?: boolean
    bands: OutfitLoadBand[]
    onchange: (next: InventoryState) => void
    onOpenOutfit: () => void
    onSetBandMarks: (index: number, marks: string) => void
  }

  let { state, reminder, readonly = false, bands, onchange, onOpenOutfit, onSetBandMarks }: Props = $props()
</script>

<div class="band-only compact">
  <div class="load-bar">
    <label class="load-select-wrap">
      <span class="sub">Load</span>
      <select
        class="load-select"
        disabled={readonly}
        value={state.loadBandId ?? 'normal'}
        onchange={(e) => onchange(setLoadBandId(state, e.currentTarget.value as (typeof LOAD_BAND_IDS)[number]))}
      >
        {#each LOAD_BAND_IDS as id}
          <option value={id}>{LOAD_BAND_LABELS[id]}</option>
        {/each}
      </select>
    </label>
    <button type="button" class="outfit-link" disabled={readonly} onclick={onOpenOutfit}>Outfit</button>
    <span class="reminder" class:over={!reminder.within || reminder.overMax}>{reminder.text}</span>
  </div>
  <details class="thresh-fold">
    <summary>Edit thresholds</summary>
    <div class="thresholds">
      {#each bands as band, i}
        <label class="thresh-row">
          <span>{band.name}</span>
          <input
            type="text"
            disabled={readonly}
            value={band.marks}
            placeholder="e.g. 4-6 or up to 4"
            oninput={(e) => onSetBandMarks(i, e.currentTarget.value)}
          />
        </label>
      {/each}
      <button
        type="button"
        class="linkish"
        disabled={readonly}
        onclick={() => onchange(setLoadBandsOverride(state, null))}
      >
        Reset to book defaults
      </button>
    </div>
  </details>
</div>

<style>
  .band-only { display: grid; gap: 0.35rem; }
  .band-only.compact .load-bar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.85rem;
  }
  .load-select-wrap { display: inline-flex; align-items: center; gap: 0.4rem; }
  .load-select {
    font: inherit; font-size: var(--text-sm); font-weight: 600; border: 1px solid var(--line);
    border-radius: var(--radius); background: var(--paper-2); color: var(--ink);
    padding: var(--btn-pad-y) var(--btn-pad-x); min-height: var(--btn-min);
  }
  .outfit-link {
    border: 0; background: none; color: var(--accent); font: inherit; font-size: var(--text-sm);
    font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer;
    padding: 0; min-height: 0;
  }
  .outfit-link:disabled { opacity: 0.45; cursor: default; }
  .thresh-fold { margin: 0; }
  .thresh-fold summary {
    cursor: pointer; font-size: 0.78rem; color: var(--ink-muted);
    text-decoration: underline; text-underline-offset: 2px; list-style: none;
  }
  .thresh-fold summary::-webkit-details-marker { display: none; }
  .reminder { margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--ink-muted); }
  .reminder.over { color: var(--danger); }
  .sub { margin: 0; font-weight: 600; font-size: 0.88rem; }
  .linkish {
    border: 0; background: none; color: var(--accent); font: inherit; font-size: 0.85rem;
    text-decoration: underline; text-underline-offset: 2px; cursor: pointer; padding: 0; justify-self: start;
  }
  .thresholds { display: grid; gap: 0.45rem; margin-top: 0.55rem; }
  .thresh-row {
    display: grid; grid-template-columns: 7rem 1fr; gap: 0.5rem; align-items: center; font-size: 0.88rem;
  }
  .thresh-row input {
    box-sizing: border-box; border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--paper); color: var(--ink); padding: 0.45rem 0.6rem; font: inherit;
  }
</style>
