<script lang="ts">
  import type { InsertDef } from '../../../content/types'
  import Field from '../../../components/Field.svelte'
  import ChipPicker from '../../../components/ChipPicker.svelte'

  interface AnimalType {
    id: string
    examples?: string[]
    base?: { max_hp?: number; armor?: number; damage?: string }
    pick_extra?: number
    options?: string[]
  }

  interface Props {
    insert: InsertDef
    // Named `data`, not `state` — a local var named `state` collides with
    // the `$state` rune elsewhere in this file (Svelte 5 gotcha).
    data: Record<string, unknown>
    readonly?: boolean
    onchange: (next: Record<string, unknown>) => void
  }

  let { insert, data, readonly = false, onchange }: Props = $props()

  const types = $derived((insert.types as AnimalType[] | undefined) ?? [])
  const typeId = $derived(String(data.type_id ?? ''))
  const activeType = $derived(types.find((t) => t.id === typeId))

  const commonFields = $derived(
    (insert.common_fields as
      | { instinct?: { options?: string[] }; cost?: { options?: string[] } }
      | undefined) ?? {},
  )

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
</script>

<div class="companion">
  <Field
    label="Name"
    type="text"
    value={String(data.name ?? '')}
    disabled={readonly}
    onchange={(v) => patch((d) => { d.name = v })}
  />

  <p class="field-label">Type</p>
  <ChipPicker
    mode="single"
    disabled={readonly}
    value={typeId}
    options={types.map((t) => ({
      id: t.id,
      label: t.id.charAt(0).toUpperCase() + t.id.slice(1),
      description: t.examples?.length ? t.examples.join(', ') : null,
    }))}
    onchange={(v) => patch((d) => { d.type_id = v; d.options = [] })}
  />

  {#if activeType}
    <div class="base-readout">
      <div class="readout"><span class="k">Max HP</span><span class="v">{activeType.base?.max_hp ?? '—'}</span></div>
      <div class="readout"><span class="k">Armor</span><span class="v">{activeType.base?.armor ?? '—'}</span></div>
      <div class="readout"><span class="k">Damage</span><span class="v">{activeType.base?.damage ?? '—'}</span></div>
    </div>

    {#if activeType.options?.length}
      <p class="field-label">
        Pick {activeType.pick_extra ?? 0} more traits
        {#if Array.isArray(data.options)}· {(data.options as string[]).length} picked{/if}
      </p>
      <ChipPicker
        mode="multi"
        disabled={readonly}
        max={activeType.pick_extra}
        value={Array.isArray(data.options) ? (data.options as string[]) : []}
        options={activeType.options.map((o) => ({ id: o, label: o }))}
        onchange={(v) => patch((d) => { d.options = v })}
      />
    {/if}
  {/if}

  {#if commonFields.instinct?.options}
    <p class="field-label">Instinct</p>
    <ChipPicker
      mode="single"
      disabled={readonly}
      value={String(data.instinct ?? '')}
      options={commonFields.instinct.options.map((o) => ({ id: o, label: o }))}
      onchange={(v) => patch((d) => { d.instinct = v })}
    />
  {/if}

  {#if commonFields.cost?.options}
    <p class="field-label">Cost (to strengthen bond)</p>
    <ChipPicker
      mode="single"
      disabled={readonly}
      value={String(data.cost ?? '')}
      options={commonFields.cost.options.map((o) => ({ id: o, label: o }))}
      onchange={(v) => patch((d) => { d.cost = v })}
    />
  {/if}

  <Field
    label="Loyalty"
    type="counter"
    min={0}
    max={3}
    value={typeof data.loyalty === 'number' ? data.loyalty : 0}
    disabled={readonly}
    onchange={(v) => patch((d) => { d.loyalty = v })}
  />

  <Field
    label="Notes"
    type="text"
    value={String(data.notes ?? '')}
    disabled={readonly}
    onchange={(v) => patch((d) => { d.notes = v })}
  />
</div>

<style>
  .companion {
    display: grid;
    gap: 0.25rem;
  }
  .field-label {
    margin: 0.6rem 0 0;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
  }
  .base-readout {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin: 0.5rem 0 0.25rem;
  }
  .readout {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.4rem 0.65rem;
    border-radius: 10px;
    background: var(--paper-2);
    border: 1px solid var(--line);
    min-width: 4rem;
  }
  .readout .k {
    font-size: 0.68rem;
    color: var(--ink-muted);
    text-transform: uppercase;
  }
  .readout .v {
    font-size: 1rem;
    font-weight: 700;
  }
</style>
