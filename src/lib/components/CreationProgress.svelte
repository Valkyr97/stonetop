<script lang="ts">
  interface Props {
    label: string
    stepNumber: number
    stepCount: number
    progress: number
  }

  let { label, stepNumber, stepCount, progress }: Props = $props()
</script>

<div class="progress">
  <div class="meta">
    <span>{label}</span>
    <span>Step {stepNumber} of {stepCount}</span>
  </div>
  <div
    class="track"
    aria-label="Creation progress"
    role="progressbar"
    aria-valuenow={stepNumber}
    aria-valuemin={1}
    aria-valuemax={stepCount}
  >
    <div class="fill" style={`width: ${progress * 100}%`}></div>
  </div>
</div>

<style>
  .progress {
    display: grid;
    gap: 0.45rem;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    font-size: 0.88rem;
    color: var(--ink-muted);
  }
  .track {
    height: 0.4rem;
    width: 100%;
    overflow: hidden;
    border-radius: 999px;
    background: var(--line);
  }
  .fill {
    height: 100%;
    border-radius: 999px;
    background: var(--accent);
    transition: width 0.2s ease;
  }
</style>
