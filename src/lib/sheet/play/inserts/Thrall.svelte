<script lang="ts">
  import type { InsertDef } from '../../../content/types'
  import Field from '../../../components/Field.svelte'
  import ChipPicker from '../../../components/ChipPicker.svelte'

  interface NamedOption {
    id: string
    name: string
    text?: string
    hp_penalty?: number
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

  const instinctOptions = $derived((insert.instinct_options as NamedOption[] | undefined) ?? [])
  const impulseOptions = $derived((insert.master_impulse_options as string[] | undefined) ?? [])
  const markOptions = $derived((insert.mark_options as NamedOption[] | undefined) ?? [])
  const marks = $derived(Array.isArray(data.marks) ? (data.marks as string[]) : [])
  const tracker = $derived(
    (insert.tracker as { label?: string; boxes?: number } | undefined) ?? { label: 'Favor', boxes: 3 },
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

<div class="thrall">
  <Field
    label="Your master's name"
    type="text"
    value={String(data.master_name ?? '')}
    disabled={readonly}
    onchange={(v) => patch((d) => { d.master_name = v })}
  />

  <p class="field-label">Master's Impulse (GM-chosen)</p>
  <ChipPicker
    mode="single"
    disabled={readonly}
    value={String(data.master_impulse ?? '')}
    options={impulseOptions.map((o) => ({ id: o, label: o }))}
    onchange={(v) => patch((d) => { d.master_impulse = v })}
  />

  <p class="field-label">Instinct (replaces your playbook's instinct)</p>
  <ChipPicker
    mode="single"
    disabled={readonly}
    value={String(data.instinct_id ?? '')}
    options={instinctOptions.map((o) => ({ id: o.id, label: o.name, description: o.text ?? null }))}
    onchange={(v) => patch((d) => { d.instinct_id = v })}
  />

  <Field
    label={tracker.label ?? 'Favor'}
    type="counter"
    min={0}
    max={tracker.boxes ?? 3}
    value={typeof data.favor === 'number' ? data.favor : 0}
    disabled={readonly}
    onchange={(v) => patch((d) => { d.favor = v })}
  />

  <p class="field-label">Marks ({marks.length} gained)</p>
  <ChipPicker
    mode="multi"
    disabled={readonly}
    value={marks}
    options={markOptions.map((o) => ({
      id: o.id,
      label: o.name,
      description: o.hp_penalty ? `−${o.hp_penalty} max HP` : null,
    }))}
    onchange={(v) => patch((d) => { d.marks = v })}
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
  .thrall {
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
</style>
