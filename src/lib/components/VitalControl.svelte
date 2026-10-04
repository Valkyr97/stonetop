<!--
  Compact or full HP / armor stepper. Boxes optional; compact mode
  stacks − value + in one row for denser sheet layouts.
-->
<script lang="ts">
  interface Props {
    label: string
    value: number
    max?: number
    min?: number
    boxes?: number
    readonly?: boolean
    hint?: string
    /** Denser row for Sheet: − value + without tall cards. */
    compact?: boolean
    onchange: (value: number) => void
  }

  let {
    label,
    value,
    max = Infinity,
    min = 0,
    boxes,
    readonly = false,
    hint,
    compact = false,
    onchange,
  }: Props = $props()

  const boxCount = $derived(
    compact
      ? 0
      : typeof boxes === 'number'
        ? Math.max(0, boxes)
        : Number.isFinite(max)
          ? Math.max(0, Math.floor(max))
          : 0,
  )

  function clamp(n: number) {
    const lo = min
    const hi = Number.isFinite(max) ? max : Number.POSITIVE_INFINITY
    return Math.max(lo, Math.min(hi, n))
  }

  function bump(delta: number) {
    if (readonly) return
    onchange(clamp(value + delta))
  }

  function tapBox(i: number) {
    if (readonly) return
    onchange(clamp(i < value ? i : i + 1))
  }
</script>

<section class="vital" class:compact aria-label={label}>
  {#if compact}
    <span class="vital-label">{label}</span>
    <div class="compact-row">
      <button
        type="button"
        class="step"
        disabled={readonly || value <= min}
        aria-label={`Decrease ${label}`}
        onclick={() => bump(-1)}
      >−</button>
      <span class="vital-readout">
        {value}{#if Number.isFinite(max)}<span class="max">/{max}</span>{/if}
      </span>
      <button
        type="button"
        class="step"
        disabled={readonly || (Number.isFinite(max) && value >= max)}
        aria-label={`Increase ${label}`}
        onclick={() => bump(1)}
      >+</button>
    </div>
  {:else}
    <header class="vital-head">
      <h3 class="vital-label">{label}</h3>
      <span class="vital-readout">
        {value}{#if Number.isFinite(max)}<span class="max">/{max}</span>{/if}
      </span>
    </header>
    <div class="stepper">
      <button
        type="button"
        class="step"
        disabled={readonly || value <= min}
        aria-label={`Decrease ${label}`}
        onclick={() => bump(-1)}
      >−</button>
      <button
        type="button"
        class="step"
        disabled={readonly || (Number.isFinite(max) && value >= max)}
        aria-label={`Increase ${label}`}
        onclick={() => bump(1)}
      >+</button>
    </div>
    {#if boxCount > 0}
      <div class="boxes" role="group" aria-label={`${label} boxes`}>
        {#each Array(boxCount) as _, i}
          <button
            type="button"
            class="box"
            class:on={i < value}
            disabled={readonly}
            aria-pressed={i < value}
            aria-label={`${label} ${i + 1}`}
            onclick={() => tapBox(i)}
          ></button>
        {/each}
      </div>
    {/if}
  {/if}

  {#if hint}
    <p class="hint">{hint}</p>
  {/if}
</section>

<style>
  .vital {
    display: grid;
    gap: 0.55rem;
    padding: 0.85rem 0.9rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper-2);
  }
  .vital.compact {
    gap: 0.25rem;
    padding: 0.45rem 0.55rem;
  }
  .vital-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .vital-label {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .vital.compact .vital-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
  }
  .vital-readout {
    font-variant-numeric: tabular-nums;
    font-size: 1.35rem;
    font-weight: 700;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    line-height: 1;
    text-align: center;
    min-width: 2.75rem;
  }
  .vital.compact .vital-readout {
    font-size: 1.05rem;
  }
  .vital-readout .max {
    font-size: 0.85em;
    font-weight: 600;
    color: var(--ink-muted);
  }
  .compact-row {
    display: grid;
    grid-template-columns: var(--btn-min) 1fr var(--btn-min);
    gap: 0.2rem;
    align-items: center;
  }
  .stepper {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.55rem;
  }
  .step {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--btn-min);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1;
    padding: 0;
    cursor: pointer;
    touch-action: manipulation;
  }
  .vital.compact .step {
    width: 100%;
    min-height: var(--btn-min);
    height: var(--btn-min);
    font-size: 1.15rem;
  }
  .step:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .step:not(:disabled):active {
    background: var(--selected-bg);
  }
  .boxes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .box {
    width: 1.1rem;
    height: 1.1rem;
    border: 1.5px solid var(--ink-muted);
    border-radius: 3px;
    background: var(--paper);
    padding: 0;
    min-height: 0;
    cursor: pointer;
    touch-action: manipulation;
  }
  .box.on {
    border-color: var(--accent);
    background: var(--accent);
  }
  .box:disabled {
    cursor: default;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
</style>
