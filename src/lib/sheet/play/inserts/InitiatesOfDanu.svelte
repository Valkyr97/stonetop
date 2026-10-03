<script lang="ts">
  import type { InsertDef } from '../../../content/types'
  import Field from '../../../components/Field.svelte'
  import ChipPicker from '../../../components/ChipPicker.svelte'

  interface Props {
    insert: InsertDef
    // Named `data`, not `state` — a local var named `state` collides with
    // the `$state` rune elsewhere in this file (Svelte 5 gotcha).
    data: Record<string, unknown>
    readonly?: boolean
    onchange: (next: Record<string, unknown>) => void
  }

  let { insert, data, readonly = false, onchange }: Props = $props()

  // NOTE: the pack field is `initiates` (a fixed cast of 5 named NPCs), not
  // `members` — that was the historical field-name mismatch this component
  // exists to fix once and for all.
  const initiates = $derived(insert.initiates ?? [])
  const chooseRange = $derived((insert.choose as { min?: number; max?: number } | undefined) ?? {})
  const picked = $derived(Array.isArray(data.picked) ? (data.picked as string[]) : [])
  const answers = $derived((data.answers as Record<string, Record<string, string>> | undefined) ?? {})

  function patch(mutator: (draft: Record<string, unknown>) => void) {
    let next: Record<string, unknown>
    try {
      next = $state.snapshot(data) as Record<string, unknown>
    } catch {
      next = JSON.parse(JSON.stringify(data)) as Record<string, unknown>
    }
    mutator(next)
    onchange(next)
  }

  function setAnswer(initiateId: string, key: string, value: string) {
    patch((d) => {
      const nextAnswers = { ...answers, [initiateId]: { ...(answers[initiateId] ?? {}), [key]: value } }
      d.answers = nextAnswers
    })
  }

  function fieldOptions(field: { options?: string[] }): { id: string; label: string }[] {
    return (field.options ?? []).map((o) => ({ id: o, label: o }))
  }
</script>

<div class="initiates">
  <p class="lede">
    Choose {chooseRange.min ?? 2}–{chooseRange.max ?? 3} as your fellow initiates. The rest are crossed off.
  </p>

  <ChipPicker
    mode="multi"
    disabled={readonly}
    max={chooseRange.max}
    value={picked}
    options={initiates.map((i) => ({ id: i.id, label: i.name }))}
    onchange={(v) => patch((d) => { d.picked = v })}
  />

  {#each initiates.filter((i) => picked.includes(i.id)) as initiate}
    <div class="card">
      <h4>{initiate.name}</h4>
      {#each Object.entries(initiate.fields ?? {}) as [key, field]}
        {@const f = field as { type?: string; options?: string[] }}
        {#if f.type === 'single_choice' && f.options}
          <Field
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            type="single_choice"
            options={fieldOptions(f)}
            value={answers[initiate.id]?.[key] ?? ''}
            disabled={readonly}
            onchange={(v) => setAnswer(initiate.id, key, String(v))}
          />
        {/if}
      {/each}
    </div>
  {/each}

  <Field
    label="Notes"
    type="text"
    value={String(data.notes ?? '')}
    disabled={readonly}
    onchange={(v) => patch((d) => { d.notes = v })}
  />
</div>

<style>
  .initiates {
    display: grid;
    gap: 0.25rem;
  }
  .lede {
    margin: 0 0 0.25rem;
    color: var(--ink-muted);
    font-size: 0.9rem;
  }
  .card {
    padding: 0.75rem 0.85rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--paper-2);
    margin: 0.25rem 0 0.85rem;
  }
  .card h4 {
    margin: 0 0 0.5rem;
    font-size: 0.98rem;
  }
</style>
