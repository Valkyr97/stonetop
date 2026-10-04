<script lang="ts">
  import type { InsertDef } from '../../../content/types'
  import Field from '../../../components/Field.svelte'
  import ChipPicker from '../../../components/ChipPicker.svelte'
  import VitalControl from '../../../components/VitalControl.svelte'
  import { isAnimalCompanionCreated } from '../../engine/inserts'

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
    mode?: 'play' | 'edit'
    onchange: (next: Record<string, unknown>) => void
  }

  let { insert, data, readonly = false, mode = 'play', onchange }: Props = $props()

  const types = $derived((insert.types as AnimalType[] | undefined) ?? [])
  const created = $derived(isAnimalCompanionCreated(data))
  const showForm = $derived(created && mode === 'edit')

  let formOpen = $state(false)
  let draft = $state<Record<string, unknown>>({})

  const commonFields = $derived(
    (insert.common_fields as
      | { instinct?: { options?: string[] }; cost?: { options?: string[] } }
      | undefined) ?? {},
  )

  function snapshot(value: Record<string, unknown>): Record<string, unknown> {
    try {
      return $state.snapshot(value) as Record<string, unknown>
    } catch {
      return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
    }
  }

  function patchLive(mutator: (draft: Record<string, unknown>) => void) {
    const next = snapshot(data)
    mutator(next)
    onchange(next)
  }

  function patchDraft(mutator: (next: Record<string, unknown>) => void) {
    const next = snapshot(draft)
    mutator(next)
    draft = next
  }

  function typeLabel(id: string) {
    if (!id) return ''
    return id.charAt(0).toUpperCase() + id.slice(1)
  }

  function applyType(next: Record<string, unknown>, typeId: string) {
    next.type_id = typeId
    next.options = []
    const t = types.find((x) => x.id === typeId)
    next.hp_max = t?.base?.max_hp ?? 0
    next.hp_current = t?.base?.max_hp ?? 0
    next.armor = t?.base?.armor ?? 0
  }

  function hpMaxOf(formData: Record<string, unknown>, type: AnimalType | undefined) {
    return typeof formData.hp_max === 'number' ? formData.hp_max : (type?.base?.max_hp ?? 0)
  }

  function hpOf(formData: Record<string, unknown>, type: AnimalType | undefined) {
    return typeof formData.hp_current === 'number' ? formData.hp_current : hpMaxOf(formData, type)
  }

  function armorOf(formData: Record<string, unknown>, type: AnimalType | undefined) {
    return typeof formData.armor === 'number' ? formData.armor : (type?.base?.armor ?? 0)
  }

  function loyaltyOf(formData: Record<string, unknown>) {
    return typeof formData.loyalty === 'number' ? formData.loyalty : 0
  }

  function openCreate() {
    if (readonly) return
    draft = snapshot(data)
    formOpen = true
  }

  function closeForm() {
    formOpen = false
  }

  function saveForm() {
    onchange(snapshot(draft))
    formOpen = false
  }

  const canSave = $derived(isAnimalCompanionCreated(draft))

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) closeForm()
  }
</script>

{#snippet companionForm(formData: Record<string, unknown>, apply: (mutator: (next: Record<string, unknown>) => void) => void)}
  {@const typeId = String(formData.type_id ?? '')}
  {@const activeType = types.find((t) => t.id === typeId)}
  <Field
    label="Name"
    type="text"
    value={String(formData.name ?? '')}
    disabled={readonly}
    onchange={(v) => apply((d) => { d.name = v })}
  />

  <p class="field-label">Type</p>
  <ChipPicker
    mode="single"
    disabled={readonly}
    value={typeId}
    options={types.map((t) => ({
      id: t.id,
      label: typeLabel(t.id),
      description: t.examples?.length ? t.examples.join(', ') : null,
    }))}
    onchange={(v) => apply((d) => { applyType(d, String(v)) })}
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
        {#if Array.isArray(formData.options)}· {(formData.options as string[]).length} picked{/if}
      </p>
      <ChipPicker
        mode="multi"
        disabled={readonly}
        max={activeType.pick_extra}
        value={Array.isArray(formData.options) ? (formData.options as string[]) : []}
        options={activeType.options.map((o) => ({ id: o, label: o }))}
        onchange={(v) => apply((d) => { d.options = v })}
      />
    {/if}
  {/if}

  <Field
    label="HP"
    type="counter"
    min={0}
    max={hpMaxOf(formData, activeType) || undefined}
    value={hpOf(formData, activeType)}
    disabled={readonly}
    onchange={(v) => apply((d) => { d.hp_current = Number(v) })}
  />
  <Field
    label="Max HP"
    type="counter"
    min={0}
    value={hpMaxOf(formData, activeType)}
    disabled={readonly}
    onchange={(v) => apply((d) => { d.hp_max = Number(v) })}
  />
  <Field
    label="Armor"
    type="counter"
    min={0}
    value={armorOf(formData, activeType)}
    disabled={readonly}
    onchange={(v) => apply((d) => { d.armor = Number(v) })}
  />

  {#if commonFields.instinct?.options}
    <p class="field-label">Instinct</p>
    <ChipPicker
      mode="single"
      disabled={readonly}
      value={String(formData.instinct ?? '')}
      options={commonFields.instinct.options.map((o) => ({ id: o, label: o }))}
      onchange={(v) => apply((d) => { d.instinct = v })}
    />
  {/if}

  {#if commonFields.cost?.options}
    <p class="field-label">Cost (to strengthen bond)</p>
    <ChipPicker
      mode="single"
      disabled={readonly}
      value={String(formData.cost ?? '')}
      options={commonFields.cost.options.map((o) => ({ id: o, label: o }))}
      onchange={(v) => apply((d) => { d.cost = v })}
    />
  {/if}

  <Field
    label="Loyalty"
    type="counter"
    min={0}
    max={3}
    value={typeof formData.loyalty === 'number' ? formData.loyalty : 0}
    disabled={readonly}
    onchange={(v) => apply((d) => { d.loyalty = v })}
  />

  <Field
    label="Notes"
    type="text"
    value={String(formData.notes ?? '')}
    disabled={readonly}
    onchange={(v) => apply((d) => { d.notes = v })}
  />
{/snippet}

<div class="companion">
  {#if showForm}
    {@render companionForm(data, patchLive)}
  {:else if created}
    {@const typeId = String(data.type_id ?? '')}
    {@const activeType = types.find((t) => t.id === typeId)}
    {@const options = Array.isArray(data.options) ? (data.options as string[]) : []}
    <div class="summary">
      <h3>{String(data.name ?? '').trim() || 'Unnamed companion'}</h3>
      {#if typeId}
        <p class="line">
          <span class="k">Type</span>
          {typeLabel(typeId)}{activeType?.examples?.length ? ` (${activeType.examples.join(', ')})` : ''}
        </p>
      {/if}
      <div class="play-vitals">
        <VitalControl
          compact
          label="HP"
          value={hpOf(data, activeType)}
          max={hpMaxOf(data, activeType)}
          min={0}
          {readonly}
          onchange={(v) => patchLive((d) => { d.hp_current = v; if (typeof d.hp_max !== 'number') d.hp_max = hpMaxOf(data, activeType) })}
        />
        <VitalControl
          compact
          label="Armor"
          value={armorOf(data, activeType)}
          min={0}
          max={10}
          {readonly}
          onchange={(v) => patchLive((d) => { d.armor = v })}
        />
        <div class="readout damage-readout">
          <span class="k">Damage</span>
          <span class="v">{activeType?.base?.damage ?? '—'}</span>
        </div>
        <VitalControl
          label="Loyalty"
          value={loyaltyOf(data)}
          min={0}
          max={3}
          boxes={3}
          {readonly}
          onchange={(v) => patchLive((d) => { d.loyalty = v })}
        />
      </div>
      {#if options.length}
        <p class="line"><span class="k">Traits</span> {options.join(', ')}</p>
      {/if}
      {#if data.instinct}
        <p class="line"><span class="k">Instinct</span> {String(data.instinct)}</p>
      {/if}
      {#if data.cost}
        <p class="line"><span class="k">Cost</span> {String(data.cost)}</p>
      {/if}
      {#if data.notes}
        <p class="line"><span class="k">Notes</span> {String(data.notes)}</p>
      {/if}
    </div>
  {:else}
    <p class="empty">No companion yet.</p>
    {#if !readonly}
      <button type="button" class="add" onclick={openCreate}>Create companion</button>
    {/if}
  {/if}
</div>

{#if formOpen}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="modal-backdrop" role="presentation" onclick={onBackdrop}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="companion-form-title">
      <header class="modal-head">
        <h3 id="companion-form-title">Create companion</h3>
        <button type="button" class="act" onclick={closeForm}>Cancel</button>
      </header>
      <div class="modal-body">
        {@render companionForm(draft, patchDraft)}
      </div>
      <footer class="modal-foot">
        <button type="button" class="act primary" disabled={readonly || !canSave} onclick={saveForm}>Save companion</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .companion {
    display: grid;
    gap: 0.25rem;
  }
  .empty {
    margin: 0 0 0.75rem;
    color: var(--ink-muted);
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
  .summary {
    display: grid;
    gap: 0.35rem;
  }
  .summary h3 {
    margin: 0 0 0.15rem;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.15rem;
  }
  .line {
    margin: 0;
    font-size: 0.95rem;
  }
  .line.muted { color: var(--ink-muted); }
  .play-vitals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    margin: 0.35rem 0 0.5rem;
  }
  .damage-readout {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.45rem 0.55rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper-2);
  }
  .damage-readout .v {
    font-size: 1.05rem;
    font-weight: 700;
  }
  @media (min-width: 520px) {
    .play-vitals {
      grid-template-columns: repeat(4, minmax(0, 1fr));
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
    margin-right: 0;
  }
  .readout .v {
    font-size: 1rem;
    font-weight: 700;
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
  .modal-body { overflow: auto; flex: 1; min-height: 0; }
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
</style>
