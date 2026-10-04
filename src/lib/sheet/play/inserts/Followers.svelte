<script lang="ts">
  import type { InsertDef } from '../../../content/types'
  import Field from '../../../components/Field.svelte'
  import VitalControl from '../../../components/VitalControl.svelte'
  import {
    followerOtherTags,
    followerSpecialTags,
    withFollowerSpecialTags,
  } from '../../engine/inserts'

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
    mode?: 'play' | 'edit'
    onchange: (next: Record<string, unknown>) => void
  }

  let { insert, data, readonly = false, mode = 'play', onchange }: Props = $props()

  const maxSlots = $derived(
    ((insert.state_schema as { slots?: { max?: number } } | undefined)?.slots?.max) ?? 2,
  )
  const slots = $derived(Array.isArray(data.slots) ? (data.slots as FollowerSlot[]) : [])

  let formOpen = $state(false)
  let draft = $state<FollowerSlot>(emptySlot())

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

  function snapshotData(): Record<string, unknown> {
    try {
      return $state.snapshot(data) as Record<string, unknown>
    } catch {
      return JSON.parse(JSON.stringify(data)) as Record<string, unknown>
    }
  }

  function patch(mutator: (draft: Record<string, unknown>) => void) {
    const next = snapshotData()
    mutator(next)
    onchange(next)
  }

  function openAdd() {
    if (readonly || slots.length >= maxSlots) return
    draft = emptySlot()
    formOpen = true
  }

  function closeForm() {
    formOpen = false
  }

  function saveForm() {
    if (readonly || slots.length >= maxSlots) return
    patch((d) => {
      d.slots = [...slots, { ...draft, hp_current: draft.hp_max }]
    })
    formOpen = false
  }

  function updateSlot(i: number, key: keyof FollowerSlot, value: string | number) {
    patch((d) => {
      d.slots = slots.map((s, idx) => {
        if (idx !== i) return s
        if (key === 'hp_max') {
          const max = Number(value)
          const hp = s.hp_current === s.hp_max || s.hp_current > max ? max : s.hp_current
          return { ...s, hp_max: max, hp_current: hp }
        }
        return { ...s, [key]: value }
      })
    })
  }

  function updateSpecialTags(i: number, special: string[]) {
    updateSlot(i, 'tags', withFollowerSpecialTags(slots[i]?.tags ?? '', special))
  }

  function updateOtherTags(i: number, other: string) {
    updateSlot(i, 'tags', withFollowerSpecialTags(other, followerSpecialTags(slots[i]?.tags ?? '')))
  }

  function setDraftSpecial(special: string[]) {
    draft = { ...draft, tags: withFollowerSpecialTags(draft.tags, special) }
  }

  function setDraftOtherTags(other: string) {
    draft = { ...draft, tags: withFollowerSpecialTags(other, followerSpecialTags(draft.tags)) }
  }

  function removeSlot(i: number) {
    patch((d) => { d.slots = slots.filter((_, idx) => idx !== i) })
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) closeForm()
  }
</script>

<div class="followers">
  {#if slots.length === 0}
    <p class="empty">No followers yet.</p>
  {:else}
    {#each slots as slot, i}
      <div class="slot">
        {#if mode === 'edit'}
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
            <Field label="Max HP" type="counter" min={0} value={slot.hp_max} disabled={readonly}
              onchange={(v) => updateSlot(i, 'hp_max', Number(v))} />
            <Field label="Armor" type="counter" min={0} value={slot.armor} disabled={readonly}
              onchange={(v) => updateSlot(i, 'armor', Number(v))} />
            <Field label="Loyalty" type="counter" min={0} max={3} value={slot.loyalty} disabled={readonly}
              onchange={(v) => updateSlot(i, 'loyalty', Number(v))} />
          </div>
          <Field label="Damage" type="text" value={slot.damage} disabled={readonly}
            onchange={(v) => updateSlot(i, 'damage', String(v))} />
          <Field
            label="Special tags"
            type="multi_choice"
            options={['exceptional', 'group']}
            value={followerSpecialTags(slot.tags)}
            disabled={readonly}
            onchange={(v) => updateSpecialTags(i, Array.isArray(v) ? v.map(String) : [])}
          />
          <Field
            label="Other tags (comma separated)"
            type="text"
            value={followerOtherTags(slot.tags)}
            disabled={readonly}
            onchange={(v) => updateOtherTags(i, String(v))}
          />
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
        {:else}
          <h3>{slot.name.trim() || 'Unnamed follower'}</h3>
          <div class="play-vitals">
            <VitalControl
              compact
              label="HP"
              value={slot.hp_current}
              max={slot.hp_max || undefined}
              min={0}
              {readonly}
              onchange={(v) => updateSlot(i, 'hp_current', v)}
            />
            <VitalControl
              compact
              label="Armor"
              value={slot.armor}
              min={0}
              max={10}
              {readonly}
              onchange={(v) => updateSlot(i, 'armor', v)}
            />
            <div class="readout damage-readout">
              <span class="k">Damage</span>
              <span class="v">{slot.damage || '—'}</span>
            </div>
            <VitalControl
              label="Loyalty"
              value={slot.loyalty}
              min={0}
              max={3}
              boxes={3}
              {readonly}
              onchange={(v) => updateSlot(i, 'loyalty', v)}
            />
          </div>
          {#if slot.tags}<p class="line"><span class="k">Tags</span> {slot.tags}</p>{/if}
          {#if slot.instinct}<p class="line"><span class="k">Instinct</span> {slot.instinct}</p>{/if}
          {#if slot.moves}<p class="line"><span class="k">Moves</span> {slot.moves}</p>{/if}
          {#if slot.cost}<p class="line"><span class="k">Cost</span> {slot.cost}</p>{/if}
          {#if slot.gear}<p class="line"><span class="k">Gear</span> {slot.gear}</p>{/if}
          {#if slot.notes}<p class="line"><span class="k">Notes</span> {slot.notes}</p>{/if}
        {/if}
      </div>
    {/each}
  {/if}

  {#if !readonly && slots.length < maxSlots}
    <button type="button" class="add" onclick={openAdd}>Add follower</button>
  {/if}
</div>

{#if formOpen}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="modal-backdrop" role="presentation" onclick={onBackdrop}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="follower-form-title">
      <header class="modal-head">
        <h3 id="follower-form-title">Add follower</h3>
        <button type="button" class="act" onclick={closeForm}>Cancel</button>
      </header>
      <div class="modal-body">
        <Field label="Name" type="text" value={draft.name} disabled={readonly}
          onchange={(v) => (draft.name = String(v))} />
        <div class="grid">
          <Field label="Max HP" type="counter" min={0} value={draft.hp_max} disabled={readonly}
            onchange={(v) => (draft.hp_max = Number(v))} />
          <Field label="Armor" type="counter" min={0} value={draft.armor} disabled={readonly}
            onchange={(v) => (draft.armor = Number(v))} />
          <Field label="Loyalty" type="counter" min={0} max={3} value={draft.loyalty} disabled={readonly}
            onchange={(v) => (draft.loyalty = Number(v))} />
        </div>
        <Field label="Damage" type="text" value={draft.damage} disabled={readonly}
          onchange={(v) => (draft.damage = String(v))} />
        <Field
          label="Special tags"
          type="multi_choice"
          options={['exceptional', 'group']}
          value={followerSpecialTags(draft.tags)}
          disabled={readonly}
          onchange={(v) => setDraftSpecial(Array.isArray(v) ? v.map(String) : [])}
        />
        <Field
          label="Other tags (comma separated)"
          type="text"
          value={followerOtherTags(draft.tags)}
          disabled={readonly}
          onchange={(v) => setDraftOtherTags(String(v))}
        />
        <Field label="Instinct" type="text" value={draft.instinct} disabled={readonly}
          onchange={(v) => (draft.instinct = String(v))} />
        <Field label="Moves (comma separated)" type="text" value={draft.moves} disabled={readonly}
          onchange={(v) => (draft.moves = String(v))} />
        <Field label="Cost (to strengthen bond)" type="text" value={draft.cost} disabled={readonly}
          onchange={(v) => (draft.cost = String(v))} />
        <Field label="Gear" type="text" value={draft.gear} disabled={readonly}
          onchange={(v) => (draft.gear = String(v))} />
        <Field label="Notes" type="text" value={draft.notes} disabled={readonly}
          onchange={(v) => (draft.notes = String(v))} />
      </div>
      <footer class="modal-foot">
        <button type="button" class="act primary" disabled={readonly} onclick={saveForm}>Save follower</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .followers {
    display: grid;
    gap: 0.85rem;
  }
  .empty {
    margin: 0;
    color: var(--ink-muted);
  }
  .slot {
    padding: 0.85rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--paper-2);
  }
  .slot h3 {
    margin: 0 0 0.25rem;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.1rem;
  }
  .line { margin: 0.15rem 0 0; font-size: 0.95rem; }
  .line.muted { color: var(--ink-muted); }
  .play-vitals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    margin: 0.4rem 0 0.5rem;
  }
  .damage-readout {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.45rem 0.55rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .damage-readout .v {
    font-size: 1.05rem;
    font-weight: 700;
  }
  @media (min-width: 520px) {
    .play-vitals {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      align-items: start;
    }
  }
  .k {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-muted);
    margin-right: 0.35rem;
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
    background: var(--paper);
    color: var(--ink);
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
    grid-template-columns: repeat(3, 1fr);
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
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: color-mix(in srgb, var(--ink) 45%, transparent);
  }
  .modal {
    width: min(36rem, 100%);
    max-height: min(90vh, 44rem);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.1rem 1.1rem;
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    border: 1px solid var(--line);
    box-shadow: 0 12px 40px color-mix(in srgb, var(--ink) 25%, transparent);
  }
  .modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }
  .modal-head h3 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.25rem;
  }
  .modal-body { overflow: auto; flex: 1; min-height: 0; display: grid; gap: 0.35rem; }
  .modal-foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
  .act {
    min-height: var(--btn-min);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    padding: var(--btn-pad-y) var(--btn-pad-x);
    cursor: pointer;
  }
  .act.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-contrast);
  }
  @media (max-width: 480px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
