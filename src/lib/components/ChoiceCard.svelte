<script lang="ts">
  import { renderRuleProse, stripLeadingBoxes, stripLabeledMarkTrack } from '../content/renderProse'

  interface Props {
    title: string
    selected?: boolean
    disabled?: boolean
    badge?: string
    ruleText?: string | null
    meta?: string
    boxes?: number
    filled?: number
    /** Force mark boxes even when boxes === 1 (e.g. level-up take indicators). */
    forceMarks?: boolean
    /** Spendable play track (ammo, Nerve, …) shown top-right inside the card. */
    useBoxes?: number
    useMarked?: number
    /** Group title when marks have no per-box labels (e.g. Nerve). Never "Uses". */
    useLabel?: string | null
    /** Per-mark italic labels (book: ○ a few left ○ out). */
    useMarkLabels?: string[]
    useInteractive?: boolean
    useMaxEditable?: boolean
    onUseMark?: (marked: number) => void
    onUseMaxChange?: (boxes: number) => void
    onclick?: () => void
    onSlotClick?: (index: number) => void
    /** Green card wash when selected. Moves keep the take square only. */
    fillSelected?: boolean
  }

  let {
    title,
    selected = false,
    disabled = false,
    badge,
    ruleText = null,
    meta,
    boxes = 1,
    filled = 0,
    forceMarks = false,
    useBoxes = 0,
    useMarked = 0,
    useLabel = null,
    useMarkLabels = [],
    useInteractive = false,
    useMaxEditable = false,
    onUseMark,
    onUseMaxChange,
    onclick,
    onSlotClick,
    fillSelected = false,
  }: Props = $props()

  const slotCount = $derived(Math.max(0, boxes))
  const showMarks = $derived(forceMarks || slotCount > 1 || !!onSlotClick)
  const filledCount = $derived(
    selected && !showMarks ? Math.max(1, filled) : filled,
  )
  const showUseTrack = $derived(useBoxes >= 1)
  const markLabels = $derived(
    Array.isArray(useMarkLabels) ? useMarkLabels.map((s) => String(s).trim()) : [],
  )
  const prose = $derived.by(() => {
    if (!ruleText) return null
    let text = stripLeadingBoxes(ruleText)
    // Book puts the labeled track on the title row — drop it from body prose.
    if (showUseTrack) text = stripLabeledMarkTrack(text)
    return text || null
  })
  const interactive = $derived(!!onclick && !disabled)

  function activate() {
    if (!interactive) return
    onclick?.()
  }

  function onKey(e: KeyboardEvent) {
    if (!interactive) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate()
    }
  }

  function markLabelAt(i: number): string | null {
    const label = markLabels[i]
    return label ? label : null
  }
</script>

<div
  class="choice"
  class:selected
  class:fill={fillSelected}
  class:clickable={interactive}
  role={onclick ? 'button' : undefined}
  tabindex={interactive ? 0 : undefined}
  aria-pressed={onclick ? selected : undefined}
  aria-disabled={onclick ? disabled : undefined}
  onclick={activate}
  onkeydown={onKey}
>
  <div class="head">
    <div class="head-main">
      {#if showMarks}
        <div class="marks" aria-hidden="true">
          {#each Array(Math.max(1, slotCount)) as _, i}
            <button
              type="button"
              class="mark"
              class:on={i < filledCount}
              disabled={disabled}
              aria-label={`${title} box ${i + 1}`}
              onclick={(e) => {
                e.stopPropagation()
                if (onSlotClick) onSlotClick(i)
                else onclick?.()
              }}
            ></button>
          {/each}
        </div>
      {/if}
      <div class="titles">
        <strong>{title}</strong>
        {#if badge}<span class="badge">{badge}</span>{/if}
        {#if meta}<span class="meta">{meta}</span>{/if}
      </div>
    </div>
    {#if showUseTrack}
      <div
        class="use-track"
        role="group"
        aria-label={useLabel ? `${title} ${useLabel}` : `${title} track`}
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        {#if useLabel && markLabels.length === 0}
          <span class="use-label">{useLabel}</span>
        {/if}
        {#if useMaxEditable && onUseMaxChange}
          <label class="use-max">
            Max
            <input
              type="number"
              min="1"
              max="12"
              value={useBoxes}
              onchange={(e) =>
                onUseMaxChange(Math.max(1, Number(e.currentTarget.value) || 1))}
            />
          </label>
        {/if}
        <div class="use-marks">
          {#each Array(useBoxes) as _, i}
            {@const slotLabel = markLabelAt(i)}
            <label class="use-slot">
              <button
                type="button"
                class="use-mark"
                class:on={i < useMarked}
                disabled={!useInteractive || !onUseMark}
                aria-label={slotLabel ?? `${useLabel ?? title} ${i + 1}`}
                aria-pressed={i < useMarked}
                onclick={() => onUseMark?.(i < useMarked ? i : i + 1)}
              ></button>
              {#if slotLabel}
                <span class="use-slot-label">{slotLabel}</span>
              {/if}
            </label>
          {/each}
        </div>
      </div>
    {/if}
  </div>
  {#if prose}
    <div class="prose">{@html renderRuleProse(prose)}</div>
  {/if}
</div>

<style>
  .choice {
    display: grid;
    gap: 0.3rem;
    width: 100%;
    text-align: left;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper-2);
    padding: 0.55rem 0.7rem;
    font: inherit;
    color: var(--ink);
  }
  .choice.clickable {
    cursor: pointer;
  }
  .choice[aria-disabled='true'] {
    cursor: default;
    opacity: 0.7;
  }
  .choice.clickable:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .choice.fill.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
    background: var(--selected-bg);
  }
  .head {
    display: flex;
    gap: 0.45rem;
    align-items: baseline;
    justify-content: space-between;
  }
  .head-main {
    display: flex;
    gap: 0.45rem;
    align-items: baseline;
    min-width: 0;
  }
  .marks {
    display: flex;
    gap: 0.15rem;
    flex-shrink: 0;
  }
  .mark {
    width: 1.05rem;
    height: 1.05rem;
    border: 1.5px solid var(--ink-muted);
    border-radius: 2px;
    background: var(--paper-2);
    padding: 0;
    min-height: 0;
    cursor: pointer;
  }
  .mark:disabled {
    cursor: default;
  }
  .mark.on {
    border-color: var(--accent);
    background: var(--accent);
  }
  .titles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.6rem;
    align-items: baseline;
  }
  .titles strong {
    font-size: var(--text-prose);
    letter-spacing: 0.01em;
    line-height: 1.25;
  }
  .badge {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
    background: var(--chip);
    padding: 0.05rem 0.3rem;
    border-radius: 999px;
  }
  .meta {
    font-size: var(--text-sm);
  }
  .use-track {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: flex-end;
    gap: 0.25rem 0.55rem;
    flex-shrink: 0;
    margin-left: 0.5rem;
  }
  .use-label {
    font-size: var(--text-sm);
    font-style: italic;
    color: var(--ink-muted);
  }
  .use-max {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--ink-muted);
  }
  .use-max input {
    width: 2.8rem;
    font: inherit;
    padding: 0.1rem 0.3rem;
  }
  .use-marks {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: flex-end;
    gap: 0.25rem 0.55rem;
  }
  .use-slot {
    display: inline-flex;
    align-items: baseline;
    gap: 0.22rem;
    margin: 0;
    cursor: default;
  }
  .use-slot-label {
    font-size: var(--text-sm);
    font-style: italic;
    color: var(--ink-muted);
    white-space: nowrap;
  }
  .use-mark {
    width: 0.95rem;
    height: 0.95rem;
    border: 1.5px solid var(--ink-muted);
    border-radius: 50%;
    background: transparent;
    padding: 0;
    min-height: 0;
    cursor: pointer;
    flex-shrink: 0;
    vertical-align: middle;
  }
  .use-mark:disabled {
    cursor: default;
  }
  .use-mark.on {
    border-color: var(--accent);
    background: var(--accent);
  }
  .prose {
    font-size: var(--text-prose);
    line-height: 1.4;
    color: var(--ink);
  }
  .prose :global(p) {
    margin: 0 0 0.35rem;
  }
  .prose :global(p:last-child) {
    margin-bottom: 0;
  }
  .prose :global(p.bullet) {
    margin: 0.15rem 0 0.15rem 0.15rem;
  }
</style>
