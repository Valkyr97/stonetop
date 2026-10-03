<script lang="ts">
  interface Props {
    onPrev: () => void
    onNext: () => void
    prevDisabled?: boolean
    nextDisabled?: boolean
    prevLabel?: string
    nextLabel?: string
  }

  let {
    onPrev,
    onNext,
    prevDisabled = false,
    nextDisabled = false,
    prevLabel = 'Previous step',
    nextLabel = 'Next step',
  }: Props = $props()
</script>

<nav class="float-nav" aria-label="Step navigation">
  <button
    type="button"
    class="arrow"
    disabled={prevDisabled}
    aria-label={prevLabel}
    title={prevLabel}
    onclick={onPrev}
  >
    ‹
  </button>
  <button
    type="button"
    class="arrow next"
    class:blocked={nextDisabled}
    disabled={nextDisabled}
    aria-label={nextDisabled ? `${nextLabel} (incomplete)` : nextLabel}
    title={nextDisabled ? `${nextLabel} — finish this step first` : nextLabel}
    onclick={onNext}
  >
    {#if nextDisabled}<span class="cue" aria-hidden="true">!</span>{/if}
    ›
  </button>
</nav>

<style>
  .float-nav {
    position: fixed;
    z-index: 30;
    left: 0;
    right: 0;
    bottom: 1.15rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 1.15rem;
    pointer-events: none;
  }
  .arrow {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    width: 2rem;
    height: 2rem;
    min-height: 2rem;
    padding: 0;
    /* Guillemets sit low in the em box; a touch of bottom padding lifts them. */
    padding-bottom: 0.12em;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--paper-2) 92%, transparent);
    color: var(--ink);
    font: inherit;
    font-size: 1.15rem;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 3px 12px color-mix(in srgb, var(--ink) 10%, transparent);
    backdrop-filter: blur(8px);
  }
  .arrow.next {
    background: var(--accent);
    color: var(--accent-contrast);
    border-color: var(--accent);
  }
  .arrow.next.blocked {
    width: auto;
    min-width: 2rem;
    padding-inline: 0.45rem;
  }
  .arrow .cue {
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1;
  }
  .arrow:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .arrow:disabled {
    opacity: 0.35;
    cursor: default;
  }
  @media (min-width: 64rem) {
    .float-nav {
      left: max(0px, calc((100vw - 64rem) / 2));
      right: max(0px, calc((100vw - 64rem) / 2));
      padding: 0 1.25rem;
    }
  }
</style>
