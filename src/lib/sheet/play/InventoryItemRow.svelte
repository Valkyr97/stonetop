<script lang="ts">
  import { ITEM_USES_MAX_CAP } from '../engine/inventory'

  interface Props {
    name: string
    compact?: boolean
    dropped: boolean
    editing: boolean
    highlight?: boolean
    readonly?: boolean
    printed?: number
    effective?: number
    badge?: string
    blurb?: string
    usesMax: number
    usesMarked: number
    usesMaxEditable?: boolean
    onMarkUses: (boxIndex: number) => void
    onMarkLoad?: (boxIndex: number) => void
    onToggleEdit: () => void
    onSetUsesMax: (value: number) => void
    onPick: () => void
    onDrop: () => void
  }

  let {
    name,
    compact = false,
    dropped,
    editing,
    highlight = false,
    readonly = false,
    printed = 0,
    effective = 0,
    badge,
    blurb = '',
    usesMax,
    usesMarked,
    usesMaxEditable = false,
    onMarkUses,
    onMarkLoad,
    onToggleEdit,
    onSetUsesMax,
    onPick,
    onDrop,
  }: Props = $props()
</script>

<li class="gear-row" class:compact class:dropped class:editing={highlight}>
  <div class="gear-body">
    <div class="title-row">
      {#if printed > 0}
        <span class="slots">{'◇'.repeat(printed)}</span>
      {/if}
      <span class="name">{name}</span>
      {#if badge}
        <span class="uses">{badge}{#if compact && dropped} · dropped{/if}</span>
      {/if}
      {#if usesMax > 0}
        <div class="item-uses" role="group" aria-label={`${name} uses`}>
          {#each Array(usesMax) as _, i}
            <button
              type="button"
              class="circle"
              class:on={i < usesMarked}
              disabled={readonly}
              aria-label={`${name} use ${i + 1}`}
              aria-pressed={i < usesMarked}
              onclick={() => onMarkUses(i)}
            ></button>
          {/each}
        </div>
      {/if}
    </div>
    {#if blurb}
      <span class="desc">{blurb}</span>
    {/if}
    {#if dropped && !compact}
      <span class="meta">Dropped — not on load</span>
    {:else if editing && !dropped}
      <div class="edit-fields">
        {#if printed > 0 && onMarkLoad}
          <div class="item-load" role="group" aria-label={`${name} load`}>
            <span class="load-label">Load</span>
            {#each Array(printed) as _, i}
              <button
                type="button"
                class="box big"
                class:on={i < effective}
                aria-label={`${name} load box ${i + 1}`}
                aria-pressed={i < effective}
                onclick={() => onMarkLoad(i)}
              ></button>
            {/each}
            <span class="meta">{effective}/{printed}</span>
          </div>
        {/if}
      </div>
    {:else if printed > 0}
      <div class="item-load" role="group" aria-label={`${name} load`}>
        <span class="load-label">Load</span>
        {#each Array(printed) as _, i}
          <span class="box big static" class:on={i < effective} aria-hidden="true"></span>
        {/each}
        <span class="meta">{effective}/{printed}</span>
      </div>
    {/if}
    {#if usesMaxEditable && !dropped}
      <label class="uses-edit">
        <span class="load-label">Uses</span>
        <input
          type="number"
          min="0"
          max={ITEM_USES_MAX_CAP}
          step="1"
          value={usesMax}
          oninput={(e) => onSetUsesMax(Number(e.currentTarget.value) || 0)}
        />
      </label>
    {/if}
  </div>
  <div class="item-actions stack">
    {#if !dropped && !readonly}
      <button
        type="button"
        class="act"
        class:primary={editing}
        aria-pressed={editing}
        onclick={onToggleEdit}
      >{editing ? 'Done' : 'Edit'}</button>
    {/if}
    {#if dropped}
      <button type="button" class="act primary" disabled={readonly} onclick={onPick}>Pick</button>
    {:else}
      <button type="button" class="act danger" disabled={readonly} onclick={onDrop}>Drop</button>
    {/if}
  </div>
</li>

<style>
  .item-actions { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; flex-shrink: 0; }
  .item-actions.stack { flex-direction: column; align-items: stretch; }
  .act {
    min-height: var(--btn-min); border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--paper); color: var(--ink); font: inherit; font-size: var(--text-sm); font-weight: 600;
    padding: var(--btn-pad-y) var(--btn-pad-x); cursor: pointer; touch-action: manipulation; white-space: nowrap;
  }
  .act:disabled { opacity: 0.35; cursor: default; }
  .act.primary { border-color: var(--accent); background: var(--accent); color: var(--accent-contrast); }
  .act.danger {
    border-color: color-mix(in srgb, var(--danger) 45%, var(--line));
    color: var(--danger); background: color-mix(in srgb, var(--danger) 6%, var(--paper));
  }
  .load-label {
    font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--ink-muted); margin-right: 0.15rem;
  }
  .gear-row {
    display: flex; gap: 0.55rem; align-items: flex-start; justify-content: space-between;
    padding: 0.55rem 0.65rem; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-2);
  }
  .gear-row.dropped { opacity: 0.72; border-style: dashed; }
  .gear-row.editing {
    border-color: var(--accent);
    background: var(--selected-bg);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .gear-row.compact { align-items: center; }
  .gear-body { display: grid; gap: 0.15rem; min-width: 0; flex: 1; }
  .title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.55rem; }
  .gear-body .name { font-weight: 600; font-size: var(--text-prose); line-height: 1.25; }
  .gear-body .slots { letter-spacing: 0.05em; color: var(--ink-muted); font-size: var(--text-sm); }
  .gear-body .uses { font-size: var(--text-sm); color: var(--ink-muted); }
  .item-uses { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.2rem; }
  .edit-fields { display: flex; flex-wrap: wrap; align-items: center; gap: 0.55rem 0.85rem; }
  .uses-edit { display: inline-flex; align-items: center; gap: 0.35rem; }
  .uses-edit input {
    width: 3.25rem; box-sizing: border-box; border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--paper); color: var(--ink); padding: 0.25rem 0.35rem; font: inherit;
  }
  .gear-body .desc, .gear-body .meta { font-size: 0.78rem; line-height: 1.35; color: var(--ink-muted); }
  .item-load { display: inline-flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
  .box {
    width: 0.78rem; height: 0.78rem; border: 1.5px solid var(--line); border-radius: 1px;
    background: var(--paper); padding: 0; display: inline-block; box-sizing: border-box;
    transform: rotate(45deg); flex-shrink: 0;
  }
  .box.big { width: 0.92rem; height: 0.92rem; }
  .box.static { pointer-events: none; }
  button.box { cursor: pointer; font: inherit; color: inherit; }
  button.box:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 3px; }
  .box.on { background: var(--accent); border-color: var(--accent); }
  .circle {
    width: 1.15rem; height: 1.15rem; border: 1.5px solid var(--line); border-radius: 50%;
    background: var(--paper); padding: 0; display: inline-block; box-sizing: border-box;
    flex-shrink: 0; cursor: pointer; font: inherit; color: inherit;
  }
  .circle:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
  .circle:disabled { cursor: default; opacity: 0.75; }
  .circle.on { background: var(--accent); border-color: var(--accent); }
</style>
