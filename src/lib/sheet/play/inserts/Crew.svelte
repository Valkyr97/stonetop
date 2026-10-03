<script lang="ts">
  import type { InsertDef } from '../../../content/types'
  import Field from '../../../components/Field.svelte'
  import ChipPicker from '../../../components/ChipPicker.svelte'

  interface CrewMember {
    name: string
    tag: string
    trait: string
  }

  interface Props {
    insert: InsertDef
    // Named `data`, not `state` — a local var named `state` collides with
    // the `$state` rune elsewhere in this file (Svelte 5 gotcha).
    data: Record<string, unknown>
    backgroundId?: string | null
    readonly?: boolean
    onchange: (next: Record<string, unknown>) => void
  }

  let { insert, data, backgroundId = null, readonly = false, onchange }: Props = $props()

  const base = $derived(
    (insert.base as { tag?: string; max_hp_each?: number; armor?: number; damage?: string; loyalty_max?: number } | undefined) ?? {},
  )
  const tagChoices = $derived((insert.tag_choices as { choose?: number; options?: string[] } | undefined) ?? {})
  const bgModifiers = $derived(
    (insert.background_modifiers as Record<string, { add_tag?: string }> | undefined) ?? {},
  )
  const bonusTag = $derived(backgroundId ? bgModifiers[backgroundId]?.add_tag ?? null : null)
  const fixedTags = $derived([base.tag, bonusTag].filter((t): t is string => !!t))

  const pickedTags = $derived(Array.isArray(data.tags) ? (data.tags as string[]) : [])
  const members = $derived(Array.isArray(data.members) ? (data.members as CrewMember[]) : [])

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

  function addMember() {
    patch((d) => {
      d.members = [...members, { name: '', tag: '', trait: '' }]
    })
  }

  function updateMember(i: number, key: keyof CrewMember, value: string) {
    patch((d) => {
      const next = members.map((m, idx) => (idx === i ? { ...m, [key]: value } : m))
      d.members = next
    })
  }

  function removeMember(i: number) {
    patch((d) => {
      d.members = members.filter((_, idx) => idx !== i)
    })
  }
</script>

<div class="crew">
  <div class="base-readout">
    <div class="readout"><span class="k">HP each</span><span class="v">{base.max_hp_each ?? '—'}</span></div>
    <div class="readout"><span class="k">Armor</span><span class="v">{base.armor ?? '—'}</span></div>
    <div class="readout"><span class="k">Damage</span><span class="v">{base.damage ?? '—'}</span></div>
    <div class="readout"><span class="k">Loyalty cap</span><span class="v">{base.loyalty_max ?? 3}</span></div>
  </div>

  {#if fixedTags.length}
    <p class="field-label">Tags (from background)</p>
    <div class="fixed-tags">
      {#each fixedTags as t}<span class="tag">{t}</span>{/each}
    </div>
  {/if}

  {#if tagChoices.options?.length}
    <p class="field-label">
      Choose {tagChoices.choose ?? 2} more tags
      {#if pickedTags.length}· {pickedTags.length} picked{/if}
    </p>
    <ChipPicker
      mode="multi"
      disabled={readonly}
      max={tagChoices.choose}
      value={pickedTags}
      options={tagChoices.options
        .filter((o) => !fixedTags.includes(o))
        .map((o) => ({ id: o, label: o }))}
      onchange={(v) => patch((d) => { d.tags = v })}
    />
  {/if}

  {#if insert.instinct_choice}
    <p class="field-label">Instinct</p>
    <ChipPicker
      mode="single"
      disabled={readonly}
      value={String(data.instinct ?? '')}
      options={(insert.instinct_choice as string[]).map((o) => ({ id: o, label: o }))}
      onchange={(v) => patch((d) => { d.instinct = v })}
    />
  {/if}

  {#if insert.cost_choice}
    <p class="field-label">Cost (to strengthen bond)</p>
    <ChipPicker
      mode="single"
      disabled={readonly}
      value={String(data.cost ?? '')}
      options={(insert.cost_choice as string[]).map((o) => ({ id: o, label: o }))}
      onchange={(v) => patch((d) => { d.cost = v })}
    />
  {/if}

  <Field
    label="Loyalty"
    type="counter"
    min={0}
    max={base.loyalty_max ?? 3}
    value={typeof data.loyalty === 'number' ? data.loyalty : 0}
    disabled={readonly}
    onchange={(v) => patch((d) => { d.loyalty = v })}
  />

  <p class="field-label">Individuals who stand out</p>
  <div class="members">
    {#each members as member, i}
      <div class="member">
        <input
          class="m-input"
          placeholder="Name"
          disabled={readonly}
          value={member.name}
          oninput={(e) => updateMember(i, 'name', e.currentTarget.value)}
        />
        <input
          class="m-input"
          placeholder="Tag"
          disabled={readonly}
          value={member.tag}
          oninput={(e) => updateMember(i, 'tag', e.currentTarget.value)}
        />
        <input
          class="m-input"
          placeholder="Trait"
          disabled={readonly}
          value={member.trait}
          oninput={(e) => updateMember(i, 'trait', e.currentTarget.value)}
        />
        {#if !readonly}
          <button type="button" class="remove" onclick={() => removeMember(i)} aria-label="Remove member">✕</button>
        {/if}
      </div>
    {/each}
    {#if !readonly}
      <button type="button" class="add" onclick={addMember}>+ Add individual</button>
    {/if}
  </div>

  <Field
    label="Notes"
    type="text"
    value={String(data.notes ?? '')}
    disabled={readonly}
    onchange={(v) => patch((d) => { d.notes = v })}
  />
</div>

<style>
  .crew {
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
    margin: 0.25rem 0;
  }
  .readout {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.4rem 0.65rem;
    border-radius: 10px;
    background: var(--paper-2);
    border: 1px solid var(--line);
    min-width: 4.5rem;
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
  .fixed-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.35rem 0;
  }
  .tag {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 14%, white);
    border: 1px solid var(--accent);
    font-size: 0.82rem;
    font-weight: 600;
  }
  .members {
    display: grid;
    gap: 0.5rem;
    margin: 0.5rem 0 0.75rem;
  }
  .member {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 0.4rem;
    align-items: center;
  }
  .m-input {
    padding: 0.4rem 0.55rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--paper-2);
    font: inherit;
    font-size: 0.85rem;
  }
  .remove {
    border: 1px solid var(--danger);
    color: var(--danger);
    background: transparent;
    border-radius: 6px;
    padding: 0.35rem 0.5rem;
    cursor: pointer;
    font: inherit;
  }
  .add {
    justify-self: start;
    border: 1px dashed var(--line);
    background: transparent;
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.85rem;
    color: var(--accent);
  }
  @media (max-width: 480px) {
    .member {
      grid-template-columns: 1fr;
    }
  }
</style>
