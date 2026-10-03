<script lang="ts">
  import type { InsertDef } from '../../../content/types'
  import Field from '../../../components/Field.svelte'
  import ChipPicker from '../../../components/ChipPicker.svelte'

  interface Props {
    insert: InsertDef
    // Named `data`, not `state` — a local var named `state` collides with
    // the `$state` rune elsewhere in this file (Svelte 5 gotcha).
    data: Record<string, unknown>
    level: number
    readonly?: boolean
    onchange: (next: Record<string, unknown>) => void
  }

  let { insert, data, level, readonly = false, onchange }: Props = $props()

  const catalog = $derived((insert.catalog as { id: string; name: string }[] | undefined) ?? [])
  const startingChoose = $derived(
    (insert.starting_choice as { choose?: number } | undefined)?.choose ?? 2,
  )
  // "You start knowing 2. Each time you reach an even-numbered level, learn 1
  // new Invocation" — so the cap grows by 1 at levels 2, 4, 6...
  const cap = $derived(startingChoose + Math.floor(level / 2))
  const known = $derived(Array.isArray(data.known) ? (data.known as string[]) : [])

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

<div class="invocations">
  <p class="lede">
    Known {known.length}/{cap} — start with {startingChoose}, +1 every even level.
  </p>

  <ChipPicker
    mode="multi"
    disabled={readonly}
    max={cap}
    value={known}
    options={catalog.map((c) => ({ id: c.id, label: c.name }))}
    onchange={(v) => patch((d) => { d.known = v })}
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
  .invocations {
    display: grid;
    gap: 0.25rem;
  }
  .lede {
    margin: 0 0 0.25rem;
    color: var(--ink-muted);
    font-size: 0.9rem;
  }
</style>
