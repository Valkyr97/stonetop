<script lang="ts">
  import type { InsertDef } from '../../../content/types'
  import Field from '../../../components/Field.svelte'

  interface FollowerSlot {
    name: string
    hp_current: number
    hp_max: number
    tags: string
    armor: number
    damage: string
    instinct: string
    moves: string
    cost: string
    loyalty: number
    gear: string
    notes: string
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

  const maxSlots = $derived(
    ((insert.state_schema as { slots?: { max?: number } } | undefined)?.slots?.max) ?? 2,
  )
  const slots = $derived(Array.isArray(data.slots) ? (data.slots as FollowerSlot[]) : [])

  function emptySlot(): FollowerSlot {
    return {
      name: '',
      hp_current: 0,
      hp_max: 0,
      tags: '',
      armor: 0,
      damage: '',
      instinct: '',
      moves: '',
      cost: '',
      loyalty: 0,
      gear: '',
      notes: '',
    }
  }

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

  function addSlot() {
    if (slots.length >= maxSlots) return
    patch((d) => { d.slots = [...slots, emptySlot()] })
  }

  function updateSlot(i: number, key: keyof FollowerSlot, value: string | number) {
    patch((d) => {
      d.slots = slots.map((s, idx) => (idx === i ? { ...s, [key]: value } : s))
    })
  }

  function removeSlot(i: number) {
    patch((d) => { d.slots = slots.filter((_, idx) => idx !== i) })
  }
</script>

<div class="followers">
  {#each slots as slot, i}
    <div class="slot">
      <div class="slot-header">
        <input
          class="name-input"
          placeholder="Follower name"
          disabled={readonly}
          value={slot.name}
          oninput={(e) => updateSlot(i, 'name', e.currentTarget.value)}
        />
        {#if !readonly}
          <button type="button" class="remove" onclick={() => removeSlot(i)}>Remove</button>
        {/if}
      </div>

      <div class="grid">
        <Field label="HP" type="counter" min={0} value={slot.hp_current} disabled={readonly}
          onchange={(v) => updateSlot(i, 'hp_current', Number(v))} />
        <Field label="Max HP" type="counter" min={0} value={slot.hp_max} disabled={readonly}
          onchange={(v) => updateSlot(i, 'hp_max', Number(v))} />
        <Field label="Armor" type="counter" min={0} value={slot.armor} disabled={readonly}
          onchange={(v) => updateSlot(i, 'armor', Number(v))} />
        <Field label="Loyalty" type="counter" min={0} max={3} value={slot.loyalty} disabled={readonly}
          onchange={(v) => updateSlot(i, 'loyalty', Number(v))} />
      </div>
      <Field label="Damage" type="text" value={slot.damage} disabled={readonly}
        onchange={(v) => updateSlot(i, 'damage', String(v))} />
      <Field label="Tags (comma separated)" type="text" value={slot.tags} disabled={readonly}
        onchange={(v) => updateSlot(i, 'tags', String(v))} />
      <Field label="Instinct" type="text" value={slot.instinct} disabled={readonly}
        onchange={(v) => updateSlot(i, 'instinct', String(v))} />
      <Field label="Moves (comma separated)" type="text" value={slot.moves} disabled={readonly}
        onchange={(v) => updateSlot(i, 'moves', String(v))} />
      <Field label="Cost (to strengthen bond)" type="text" value={slot.cost} disabled={readonly}
        onchange={(v) => updateSlot(i, 'cost', String(v))} />
      <Field label="Gear" type="text" value={slot.gear} disabled={readonly}
        onchange={(v) => updateSlot(i, 'gear', String(v))} />
      <Field label="Notes" type="text" value={slot.notes} disabled={readonly}
        onchange={(v) => updateSlot(i, 'notes', String(v))} />
    </div>
  {/each}

  {#if !readonly && slots.length < maxSlots}
    <button type="button" class="add" onclick={addSlot}>+ Add follower ({slots.length}/{maxSlots})</button>
  {/if}
</div>

<style>
  .followers {
    display: grid;
    gap: 0.85rem;
  }
  .slot {
    padding: 0.85rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--paper-2);
  }
  .slot-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .name-input {
    flex: 1;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: white;
    font: inherit;
    font-weight: 600;
  }
  .remove {
    border: 1px solid var(--danger);
    color: var(--danger);
    background: transparent;
    border-radius: 6px;
    padding: 0.4rem 0.65rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }
  .add {
    justify-self: start;
    border: 1px dashed var(--line);
    background: transparent;
    border-radius: 6px;
    padding: 0.5rem 0.85rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.9rem;
    color: var(--accent);
  }
  @media (max-width: 480px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
