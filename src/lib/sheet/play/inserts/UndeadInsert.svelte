<script lang="ts">
  import type { InsertDef } from '../../../content/types'
  import Field from '../../../components/Field.svelte'
  import ChipPicker from '../../../components/ChipPicker.svelte'

  interface NamedOption {
    id: string
    name: string
    text?: string
    requires?: string
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
  const purposeOptions = $derived((insert.terrible_purpose_options as NamedOption[] | undefined) ?? [])
  const consequenceOptions = $derived((insert.consequence_options as NamedOption[] | undefined) ?? [])
  const consequences = $derived(Array.isArray(data.consequences) ? (data.consequences as string[]) : [])
  // Ghost has a `tether` text field; Revenant does not (its Undying move
  // needs no tether). Detected from state_schema rather than hardcoded id.
  const hasTether = $derived(!!(insert.state_schema as Record<string, unknown> | undefined)?.tether)

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

<div class="undead">
  <p class="field-label">Instinct (replaces your playbook's instinct)</p>
  <ChipPicker
    mode="single"
    disabled={readonly}
    value={String(data.instinct_id ?? '')}
    options={instinctOptions.map((o) => ({ id: o.id, label: o.name, description: o.text ?? null }))}
    onchange={(v) => patch((d) => { d.instinct_id = v })}
  />

  <p class="field-label">Terrible Purpose</p>
  <ChipPicker
    mode="single"
    disabled={readonly}
    value={String(data.terrible_purpose_id ?? '')}
    options={purposeOptions.map((o) => ({ id: o.id, label: o.name, description: o.text ?? null }))}
    onchange={(v) => patch((d) => { d.terrible_purpose_id = v })}
  />

  {#if hasTether}
    <Field
      label="Tether (mortal remains, place you died, an object, etc.)"
      type="text"
      value={String(data.tether ?? '')}
      disabled={readonly}
      onchange={(v) => patch((d) => { d.tether = v })}
    />
  {/if}

  <p class="field-label">Consequences</p>
  <ChipPicker
    mode="multi"
    disabled={readonly}
    value={consequences}
    options={consequenceOptions.map((o) => ({
      id: o.id,
      label: o.name,
      description: o.requires ? `Requires ${o.requires}` : null,
      disabled: !!o.requires && !consequences.includes(o.requires),
    }))}
    onchange={(v) => patch((d) => { d.consequences = v })}
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
  .undead {
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
