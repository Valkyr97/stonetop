<!--
  Book-style XP frame: chamfered box, "XP" cutting the bottom border,
  tally marks in groups of five. No maximum — tallies grow with XP.
-->
<script lang="ts">
  interface Props {
    xp: number
    readonly?: boolean
    onchange: (xp: number) => void
  }

  let { xp, readonly = false, onchange }: Props = $props()

  const groups = $derived.by(() => {
    const n = Math.max(0, Math.floor(xp))
    const full = Math.floor(n / 5)
    const rem = n % 5
    const out: number[] = Array.from({ length: full }, () => 5)
    if (rem > 0 || n === 0) out.push(rem)
    return out
  })

  function add() {
    if (readonly) return
    onchange(xp + 1)
  }

  function remove() {
    if (readonly || xp <= 0) return
    onchange(xp - 1)
  }
</script>

<div class="xp-wrap">
  <div class="xp-frame" aria-hidden="true">
    <div class="tallies">
      {#each groups as count, gi}
        <span class="group">
          {#if count === 5}
            <svg viewBox="0 0 28 22" width="28" height="22">
              <line x1="3" y1="2" x2="3" y2="20" />
              <line x1="9" y1="2" x2="9" y2="20" />
              <line x1="15" y1="2" x2="15" y2="20" />
              <line x1="21" y1="2" x2="21" y2="20" />
              <line x1="1" y1="18" x2="25" y2="4" class="slash" />
            </svg>
          {:else}
            <svg viewBox="0 0 {Math.max(count, 1) * 6 + 2} 22" width={Math.max(count, 1) * 6 + 2} height="22">
              {#each Array(count) as _, i}
                <line x1={3 + i * 6} y1="2" x2={3 + i * 6} y2="20" />
              {/each}
            </svg>
          {/if}
          {#if gi < groups.length - 1}<span class="gap"></span>{/if}
        </span>
      {/each}
    </div>
    <span class="xp-label">XP</span>
  </div>
  <div class="xp-controls">
    <span class="count" aria-live="polite">{xp}</span>
    <button type="button" class="adj" disabled={readonly || xp <= 0} onclick={remove} aria-label="Remove 1 XP">−</button>
    <button type="button" class="adj" disabled={readonly} onclick={add} aria-label="Add 1 XP">+</button>
  </div>
</div>

<style>
  .xp-wrap {
    display: grid;
    gap: 0.45rem;
    max-width: 22rem;
  }
  .xp-frame {
    position: relative;
    display: block;
    width: 100%;
    min-height: 4.25rem;
    margin-bottom: 0.55rem;
    padding: 0.65rem 0.85rem 1.15rem;
    border: 2.5px solid var(--ink);
    border-radius: 3px;
    background: var(--paper);
    color: var(--ink);
    pointer-events: none;
    user-select: none;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 15%, transparent);
  }
  .tallies {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.15rem 0.35rem;
    min-height: 1.5rem;
  }
  .group {
    display: inline-flex;
    align-items: flex-end;
  }
  .tallies :global(svg) {
    display: block;
    overflow: visible;
  }
  .tallies :global(line) {
    stroke: var(--ink);
    stroke-width: 1.6;
    stroke-linecap: round;
  }
  .tallies :global(line.slash) {
    stroke-width: 1.8;
  }
  .gap {
    width: 0.35rem;
  }
  .xp-label {
    position: absolute;
    left: 50%;
    bottom: -0.55em;
    transform: translateX(-50%);
    padding: 0 0.5rem;
    background: var(--paper);
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1;
  }
  .xp-controls {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .count {
    font-variant-numeric: tabular-nums;
    font-size: 0.88rem;
    color: var(--ink-muted);
    min-width: 2.5rem;
  }
  .adj {
    width: 1.85rem;
    height: 1.85rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper-2);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .adj:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
