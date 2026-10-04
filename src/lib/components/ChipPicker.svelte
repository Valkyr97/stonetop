<script lang="ts">
  /**
   * Small reusable single/multi "chip" picker used by the rich insert
   * editors (animal companion type, crew tags, ghost's instinct, etc).
   * Not copied from any reference implementation — a thin wrapper around
   * the checkbox/radio-button pattern already used ad hoc in
   * BackgroundCard/ChoiceCard, pulled out so the insert components don't
   * each re-implement the same markup+CSS.
   */
  interface ChipOption {
    id: string
    label: string
    description?: string | null
    disabled?: boolean
  }

  interface Props {
    options: ChipOption[]
    mode?: 'single' | 'multi'
    value?: string | string[] | null
    max?: number
    disabled?: boolean
    onchange?: (value: string | string[]) => void
  }

  let { options, mode = 'multi', value = null, max, disabled = false, onchange }: Props = $props()

  function isSelected(id: string): boolean {
    if (mode === 'single') return value === id
    return Array.isArray(value) ? value.includes(id) : false
  }

  function toggle(opt: ChipOption) {
    if (disabled || opt.disabled) return
    if (mode === 'single') {
      onchange?.(value === opt.id ? '' : opt.id)
      return
    }
    const current = Array.isArray(value) ? [...value] : []
    const i = current.indexOf(opt.id)
    if (i >= 0) current.splice(i, 1)
    else {
      if (typeof max === 'number' && current.length >= max) return
      current.push(opt.id)
    }
    onchange?.(current)
  }
</script>

<div class="chips" role="group">
  {#each options as opt}
    <button
      type="button"
      class="chip"
      class:on={isSelected(opt.id)}
      disabled={disabled || opt.disabled}
      onclick={() => toggle(opt)}
    >
      <span class="mark" class:radio={mode === 'single'} class:on={isSelected(opt.id)}></span>
      <span class="text">
        <span class="label">{opt.label}</span>
        {#if opt.description}<span class="desc">{opt.description}</span>{/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .chips {
    display: grid;
    gap: 0.5rem;
    margin: 0.5rem 0 0.9rem;
  }
  .chip {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper-2);
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .chip:disabled {
    cursor: default;
    opacity: 0.55;
  }
  .chip.on {
    border-color: var(--accent);
    background: var(--selected-bg);
  }
  .mark {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    margin-top: 0.15rem;
    border: 1.5px solid var(--ink-muted);
    border-radius: 3px;
    background: var(--paper-2);
  }
  .mark.radio {
    border-radius: 50%;
  }
  .mark.on {
    border-color: var(--accent);
    background: var(--accent);
    box-shadow: inset 0 0 0 2px var(--paper-2);
  }
  .text {
    display: grid;
    gap: 0.15rem;
  }
  .label {
    font-size: 0.92rem;
    font-weight: 600;
  }
  .desc {
    font-size: 0.82rem;
    color: var(--ink-muted);
    line-height: 1.4;
  }
</style>
