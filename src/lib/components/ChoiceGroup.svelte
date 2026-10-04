<!--
  Nested "choose N" pick (Splatbook ChoiceGroup): prompt, (count/max),
  optional fixed lines, toggleable options, optional write-in.
-->
<script lang="ts">
  import {
    canPickMore,
    isSelectionValid,
    selectionCount,
    toggleOption,
    type ChoiceSelection,
  } from '../sheet/engine/choices'
  import SoftMd from './SoftMd.svelte'
  import StatusCue from './StatusCue.svelte'

  export interface ChoiceOption {
    label: string
    /** Stable id when label is display-only (e.g. move name vs move id). */
    value?: string
    writeIn?: boolean
  }

  export interface ChoiceDef {
    id: string
    prompt: string
    min: number
    max: number
    fixed?: string[]
    options: ChoiceOption[]
  }

  interface Props {
    choice: ChoiceDef
    selection?: ChoiceSelection
    disabled?: boolean
    onchange: (selection: ChoiceSelection) => void
  }

  let { choice, selection, disabled = false, onchange }: Props = $props()

  const current = $derived<ChoiceSelection>(selection ?? { selected: [] })
  const count = $derived(selectionCount(selection))
  const valid = $derived(isSelectionValid(choice, selection))
  const atMax = $derived(!canPickMore(choice, selection))

  function optionValue(opt: ChoiceOption): string {
    return opt.value ?? opt.label
  }

  function toggle(opt: ChoiceOption): void {
    if (disabled) return
    onchange(toggleOption(choice, current, optionValue(opt)))
  }

  function setWriteIn(value: string): void {
    if (disabled) return
    onchange({ ...current, writeIn: value })
  }
</script>

<fieldset class="cg" disabled={disabled}>
  <legend>
    {choice.prompt}
    <span class="count" class:ok={valid} class:warn={!valid}>
      {#if valid}
        <StatusCue kind="ok" />
      {:else}
        <StatusCue kind="warn" label="Choice incomplete" />
      {/if}
      ({count}/{choice.max})
    </span>
  </legend>

  {#if choice.fixed?.length}
    <ul class="fixed">
      {#each choice.fixed as line}
        <li><SoftMd text={line} inline /></li>
      {/each}
    </ul>
  {/if}

  <div class="opts">
    {#each choice.options as option}
      {#if option.writeIn}
        <input
          class="write-in"
          type="text"
          value={current.writeIn ?? ''}
          placeholder={option.label || 'Write your own…'}
          disabled={disabled}
          oninput={(e) => setWriteIn(e.currentTarget.value)}
        />
      {:else}
        {@const value = optionValue(option)}
        {@const on = current.selected.includes(value)}
        <button
          type="button"
          class="opt"
          class:on
          disabled={disabled || (!on && atMax)}
          aria-pressed={on}
          onclick={() => toggle(option)}
        >
          <SoftMd text={option.label} inline />
        </button>
      {/if}
    {/each}
  </div>
</fieldset>

<style>
  .cg {
    margin: 0.85rem 0 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
    font-size: 0.88rem;
    font-weight: 600;
  }
  .count {
    margin-left: 0.35rem;
    font-weight: 400;
    color: var(--ink-muted);
  }
  .count.ok {
    color: var(--accent);
  }
  .count.warn {
    color: var(--danger, #8c2f22);
  }
  .fixed {
    margin: 0.4rem 0 0;
    padding-left: 1.2rem;
    font-size: 0.88rem;
    color: var(--ink-muted);
  }
  .opts {
    display: grid;
    gap: 0.4rem;
    margin-top: 0.45rem;
  }
  .opt {
    text-align: left;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--paper-2);
    color: var(--ink);
    padding: var(--btn-pad-y) var(--btn-pad-x);
    font: inherit;
    font-size: var(--text-sm);
    min-height: var(--btn-min);
    cursor: pointer;
  }
  .opt.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
    background: var(--selected-bg);
  }
  .opt:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .write-in {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--paper);
    color: var(--ink);
    padding: var(--btn-pad-y) var(--btn-pad-x);
    font: inherit;
    font-size: var(--text-sm);
    min-height: var(--btn-min);
  }
</style>
