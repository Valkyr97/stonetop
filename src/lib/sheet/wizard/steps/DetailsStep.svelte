<script lang="ts">
  import type { CharacterState, ExtrasSectionState, Playbook } from '../../../content/types'
  import type { PatchSheet } from '../../sheetPatch'
  import ChoiceGroup from '../../../components/ChoiceGroup.svelte'
  import SoftMd from '../../../components/SoftMd.svelte'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    mode?: 'play' | 'edit'
    heading?: string
    readonly?: boolean
    patch: PatchSheet
  }

  let {
    playbook,
    sheet,
    mode = 'edit',
    heading = 'Details',
    readonly = false,
    patch,
  }: Props = $props()

  const hasExtras = $derived((playbook.extras?.length ?? 0) > 0)
  const picksLocked = $derived(mode === 'play')

  function extrasState(id: string): ExtrasSectionState {
    const all = (sheet.setup.extras as Record<string, ExtrasSectionState> | undefined) ?? {}
    return all[id] ?? {}
  }

  function patchExtras(id: string, next: Partial<ExtrasSectionState>) {
    patch((d) => {
      const all = { ...((d.setup.extras as Record<string, ExtrasSectionState> | undefined) ?? {}) }
      all[id] = { ...(all[id] ?? {}), ...next }
      d.setup.extras = all
    })
  }

  function promptValue(state: ExtrasSectionState, i: number): string {
    return String(state.prompts?.[i] ?? '').trim()
  }
</script>

<h2>{heading}</h2>
{#if hasExtras}
  <div class="details-sections">
    {#each playbook.extras ?? [] as section}
      {@const state = extrasState(section.id)}
      <section class="details-block">
        <h3>{section.title}</h3>
        {#if section.text}
          <div class="lede"><SoftMd text={section.text} /></div>
        {/if}
        {#each section.lines ?? [] as line, i}
          {#if picksLocked}
            {#if state.lines?.[i]}
              <p class="picked">{state.lines[i]}</p>
            {/if}
          {:else}
            <div class="appearance-line">
              {#each line as option}
                {@const on = state.lines?.[i] === option}
                <button
                  type="button"
                  class="pill"
                  class:on
                  disabled={readonly}
                  aria-pressed={on}
                  onclick={() => {
                    const lines = [...(state.lines ?? [])]
                    while (lines.length < (section.lines?.length ?? 0)) lines.push(null)
                    lines[i] = option
                    patchExtras(section.id, { lines })
                  }}
                >
                  {option}
                </button>
              {/each}
            </div>
          {/if}
        {/each}
        {#each section.choices ?? [] as choice}
          {#if picksLocked}
            {@const selected = state.choices?.[choice.id]?.selected ?? []}
            {#if selected.length}
              <p class="nested-label">{choice.prompt}</p>
              <p class="picked">{selected.join(', ')}</p>
            {/if}
          {:else}
            <ChoiceGroup
              choice={{
                id: choice.id,
                prompt: choice.prompt,
                min: choice.min,
                max: choice.max,
                options: choice.options.map((o) => ({ label: o.label })),
              }}
              selection={state.choices?.[choice.id]}
              disabled={readonly}
              onchange={(sel) => {
                patchExtras(section.id, {
                  choices: {
                    ...(state.choices ?? {}),
                    [choice.id]: sel,
                  },
                })
              }}
            />
          {/if}
        {/each}
        {#each section.prompts ?? [] as prompt, i}
          {@const filled = promptValue(state, i)}
          <div class="prompt-field">
            <span class="nested-label">{prompt}</span>
            {#if picksLocked && filled}
              <p class="picked">{filled}</p>
            {:else if !picksLocked || !filled}
              <input
                type="text"
                class="write-in"
                disabled={readonly}
                value={state.prompts?.[i] ?? ''}
                oninput={(e) => {
                  patchExtras(section.id, {
                    prompts: { ...(state.prompts ?? {}), [i]: e.currentTarget.value },
                  })
                }}
              />
            {/if}
          </div>
        {/each}
      </section>
    {/each}
  </div>
{:else if playbook.playbook_setup && Object.keys(playbook.playbook_setup).length}
  <div class="details-sections">
    {#each Object.entries(playbook.playbook_setup) as [blockKey, blockVal]}
      <section class="details-block">
        <h3>{blockKey.replace(/_/g, ' ')}</h3>
        {#if blockVal && typeof blockVal === 'object'}
          {#each Object.entries(blockVal as Record<string, unknown>) as [fieldKey, fieldVal]}
            {#if fieldVal && typeof fieldVal === 'object' && 'type' in (fieldVal as object)}
              {@const field = fieldVal as {
                type: string
                options?: string[]
                min?: number
                max?: number
              }}
              {@const current =
                ((sheet.setup[blockKey] as Record<string, unknown> | undefined)?.[fieldKey] as
                  | string
                  | string[]
                  | undefined) ?? (field.type.startsWith('multi') ? [] : '')}
              <div class="detail-field">
                <p class="nested-label">{fieldKey.replace(/_/g, ' ')}</p>
                {#if picksLocked}
                  {#if Array.isArray(current) && current.length}
                    <p class="picked">{current.join(', ')}</p>
                  {:else if typeof current === 'string' && current}
                    <p class="picked">{current}</p>
                  {/if}
                {:else if field.type.startsWith('multi')}
                  <div class="appearance-line">
                    {#each field.options ?? [] as opt}
                      {@const selected = Array.isArray(current) && current.includes(opt)}
                      {@const atMax =
                        Array.isArray(current) &&
                        typeof field.max === 'number' &&
                        current.length >= field.max &&
                        !selected}
                      <button
                        type="button"
                        class="pill"
                        class:on={selected}
                        disabled={readonly || atMax}
                        aria-pressed={selected}
                        onclick={() => patch((d) => {
                          const block = { ...((d.setup[blockKey] as Record<string, unknown>) ?? {}) }
                          const list = Array.isArray(block[fieldKey])
                            ? [...(block[fieldKey] as string[])]
                            : []
                          const i = list.indexOf(opt)
                          if (i >= 0) list.splice(i, 1)
                          else list.push(opt)
                          block[fieldKey] = list
                          d.setup[blockKey] = block
                        })}
                      >
                        {opt}
                      </button>
                    {/each}
                  </div>
                {:else}
                  <div class="appearance-line">
                    {#each field.options ?? [] as opt}
                      {@const on = current === opt}
                      <button
                        type="button"
                        class="pill"
                        class:on
                        disabled={readonly}
                        aria-pressed={on}
                        onclick={() => patch((d) => {
                          const block = { ...((d.setup[blockKey] as Record<string, unknown>) ?? {}) }
                          block[fieldKey] = opt
                          d.setup[blockKey] = block
                        })}
                      >
                        {opt}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        {/if}
      </section>
    {/each}
  </div>
{:else}
  <p class="help">Nothing extra for this playbook — carry on.</p>
{/if}

<style>
  .details-sections {
    display: grid;
    gap: 1.5rem;
    margin-top: 0.75rem;
  }
  .details-block h3 {
    text-transform: capitalize;
    margin: 0 0 0.4rem;
    font-size: 0.95rem;
  }
  .detail-field {
    display: grid;
    gap: 0.35rem;
    margin-bottom: 0.85rem;
  }
  .prompt-field {
    display: grid;
    gap: 0.35rem;
    margin-top: 0.75rem;
  }
  .write-in {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    padding: 0.55rem 0.75rem;
    font: inherit;
  }
  .picked {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
  }
  .nested-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink-muted);
  }
  .appearance-line {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.55rem;
  }
  .pill {
    border: 1px solid var(--line);
    background: var(--paper-2);
    color: var(--ink);
    border-radius: 999px;
    padding: var(--btn-pad-y) 0.7rem;
    font: inherit;
    font-size: var(--text-sm);
    min-height: var(--btn-min);
    cursor: pointer;
  }
  .pill.on {
    border-color: var(--accent);
    background: var(--selected-bg);
    box-shadow: 0 0 0 1px var(--accent);
    font-weight: 600;
  }
  .pill:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .help, .lede {
    color: var(--ink-muted);
    font-size: 0.9rem;
  }
</style>
