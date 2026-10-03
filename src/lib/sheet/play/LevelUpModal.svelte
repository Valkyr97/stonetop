<script lang="ts">
  import type { CharacterState, Playbook } from '../../content/types'
  import Field from '../../components/Field.svelte'
  import MovesCatalog from '../moves/MovesCatalog.svelte'
  import { moveById, STAT_KEYS, statBumpCap } from '../engine'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    readonly?: boolean
    grantSources: Map<string, string>
    xpCost: number
    pendingMoveId: string
    pendingStat: string
    levelUpError: string
    onClose: () => void
    onMarkTake: (moveId: string) => void
    onPendingStat: (stat: string) => void
    onConfirmStat: () => void
  }

  let {
    playbook,
    sheet,
    readonly = false,
    grantSources,
    xpCost,
    pendingMoveId,
    pendingStat,
    levelUpError,
    onClose,
    onMarkTake,
    onPendingStat,
    onConfirmStat,
  }: Props = $props()

  const pendingMove = $derived(pendingMoveId ? moveById(playbook, pendingMoveId) : null)
  const bumpCap = $derived(pendingMove ? statBumpCap(pendingMove) : null)
</script>

<div class="modal-backdrop" role="presentation" onclick={onClose}>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="level-up-title"
    onclick={(e) => e.stopPropagation()}
  >
    <header class="modal-head">
      <h2 id="level-up-title">Level up → {sheet.mechanics.level + 1}</h2>
      <button type="button" class="tok-btn" onclick={onClose} aria-label="Close">×</button>
    </header>
    <p class="hint">Mark one empty take box on a move. Costs {xpCost} XP. Existing marks cannot be cleared here.</p>
    <div class="modal-body">
      <MovesCatalog
        {playbook}
        {sheet}
        mode="levelup"
        {readonly}
        {grantSources}
        {onMarkTake}
      />
    </div>
    {#if pendingMoveId && bumpCap !== null}
      <Field
        label={`Raise which stat? (max +${bumpCap})`}
        type="single_choice"
        options={STAT_KEYS.filter((s) => (sheet.mechanics.stats[s] ?? 0) < bumpCap).map((s) => ({
          id: s,
          label: s,
        }))}
        value={pendingStat}
        onchange={(v) => onPendingStat(String(v))}
      />
      <footer class="modal-foot">
        <button type="button" class="action ghost" onclick={onClose}>Cancel</button>
        <button type="button" class="action" disabled={!pendingStat} onclick={onConfirmStat}>
          Confirm level up
        </button>
      </footer>
    {:else}
      <footer class="modal-foot">
        <button type="button" class="action ghost" onclick={onClose}>Close</button>
      </footer>
    {/if}
    {#if levelUpError}<p class="err">! {levelUpError}</p>{/if}
  </div>
</div>

<style>
  .tok-btn {
    width: var(--btn-min); height: var(--btn-min); min-height: var(--btn-min);
    border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--paper-2); color: var(--ink); font: inherit; font-size: var(--text-sm);
    padding: 0; cursor: pointer;
  }
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--ink) 45%, transparent);
  }
  .modal {
    width: min(36rem, 100%); max-height: min(90vh, 40rem); display: flex; flex-direction: column;
    gap: 0.75rem; padding: 1rem 1.1rem 1.1rem; border-radius: var(--radius); background: var(--paper);
    color: var(--ink); border: 1px solid var(--line);
    box-shadow: 0 12px 40px color-mix(in srgb, var(--ink) 25%, transparent);
  }
  .modal-head { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
  .modal-head h2 { margin: 0; font-family: var(--font-display); font-weight: 400; font-size: 1.35rem; }
  .modal-body { overflow: auto; flex: 1; min-height: 0; }
  .modal-foot { display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap; }
  .err { color: var(--danger); font-size: var(--text-sm); }
</style>
