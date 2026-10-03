<!--
  Renders every creation_field: interactive ChoiceGroup when options exist,
  Field for text/counter/uses, and always surfaces fixed lines / option text
  so book picks aren't invisible when automation is incomplete.
-->
<script lang="ts">
  import type { CreationField, Playbook } from '../content/types'
  import ChoiceGroup from './ChoiceGroup.svelte'
  import Field from './Field.svelte'
  import type { ChoiceSelection } from '../sheet/engine/choices'
  import {
    fieldControlType,
    fieldFixedLines,
    fieldHasVisibleContent,
    fieldOptionIds,
    fieldOptionLabel,
    fieldPrompt,
    fieldReferenceHint,
    fieldToChoiceDef,
    isInteractiveChoice,
  } from '../sheet/engine/creationFields'

  interface Props {
    fields: CreationField[]
    playbook?: Playbook | null
    values?: Record<string, unknown>
    disabled?: boolean
    /** Hide stat-bump fields on moves (handled elsewhere). */
    skipKeys?: string[]
    onFieldChange?: (key: string, value: unknown) => void
  }

  let {
    fields,
    playbook = null,
    values = {},
    disabled = false,
    skipKeys = [],
    onFieldChange,
  }: Props = $props()

  const visible = $derived(
    fields.filter((f) => !skipKeys.includes(f.key) && fieldHasVisibleContent(f)),
  )

  function selectionFor(field: CreationField): ChoiceSelection {
    const v = values[field.key]
    if (Array.isArray(v)) return { selected: v.map(String) }
    if (typeof v === 'string' && v) return { selected: [v] }
    return { selected: [] }
  }

  function onChoice(field: CreationField, sel: ChoiceSelection) {
    if (disabled || !onFieldChange) return
    const single =
      field.type === 'single_choice' ||
      field.type === 'single_choice_reference' ||
      field.type === 'single_choice_with_custom'
    if (single) onFieldChange(field.key, sel.selected[0] ?? '')
    else onFieldChange(field.key, sel.selected)
  }
</script>

{#if visible.length}
  <div class="creation-fields">
    {#each visible as field (field.key)}
      {@const choice = fieldToChoiceDef(playbook, field)}
      {@const fixed = fieldFixedLines(field)}
      {@const hint = fieldReferenceHint(field)}
      {@const opts = fieldOptionIds(field)}

      {#if choice}
        <ChoiceGroup
          {choice}
          selection={selectionFor(field)}
          {disabled}
          onchange={(sel) => onChoice(field, sel)}
        />
      {:else}
        <!-- Non-choice or choice without options: still show prompt + fixed/options text -->
        {#if fixed.length && !isInteractiveChoice(field)}
          <div class="fixed-block">
            <p class="prompt">{fieldPrompt(field)}</p>
            <ul class="fixed">
              {#each fixed as line}
                <li>{line}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if opts.length && !isInteractiveChoice(field)}
          <div class="fixed-block">
            <p class="prompt">{fieldPrompt(field)}</p>
            <ul class="fixed">
              {#each opts as id}
                <li>{fieldOptionLabel(playbook, field, id)}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if field.type === 'text' || field.type === 'counter' || field.type === 'uses' || field.type === 'number' || field.type === 'single_choice_reference' || field.type === 'content_reference' || field.type === 'insert_reference' || field.type === 'array'}
          {#if hint}
            <p class="hint">{hint}</p>
          {/if}
          {#if field.type !== 'array'}
            <Field
              label={fieldPrompt(field)}
              type={fieldControlType(field)}
              options={opts.map((id) => ({
                id,
                label: fieldOptionLabel(playbook, field, id),
              }))}
              min={field.min ?? (field.type === 'counter' || field.type === 'uses' ? 0 : undefined)}
              max={
                field.max ??
                (typeof (field as { printed_capacity?: number }).printed_capacity === 'number'
                  ? (field as { printed_capacity: number }).printed_capacity
                  : undefined)
              }
              value={values[field.key] ?? field.initial ?? (field.type === 'text' ? '' : 0)}
              {disabled}
              onchange={(v) => onFieldChange?.(field.key, v)}
            />
          {:else if !fixed.length}
            <p class="hint">{fieldPrompt(field)}</p>
          {/if}
        {/if}
      {/if}
    {/each}
  </div>
{/if}

<style>
  .creation-fields {
    display: grid;
    gap: 0.5rem;
    padding-top: 0.35rem;
    border-top: 1px dashed var(--line);
  }
  .fixed-block {
    display: grid;
    gap: 0.3rem;
  }
  .prompt {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 600;
  }
  .fixed {
    margin: 0;
    padding-left: 1.2rem;
    font-size: 0.88rem;
    color: var(--ink-muted);
  }
  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
</style>
