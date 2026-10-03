<script lang="ts">
  import type { CharacterState, Playbook } from '../../../content/types'
  import { STAT_KEYS } from '../../engine/stats'
  import {
    WIZARD_STEPS,
    readyToFinish,
    stepValid,
    type WizardStepId,
  } from '../steps'

  interface PossessionItem {
    id: string
    name: string
  }

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    onJump: (stepId: WizardStepId) => void
  }

  let { playbook, sheet, onJump }: Props = $props()

  const possessions = $derived(
    (playbook.special_possessions as { options?: PossessionItem[] }) ?? {},
  )
  const chosenInstinct = $derived(
    playbook.instincts.find((i) => i.id === sheet.identity.instinct_id) ?? null,
  )
</script>

<h2>Review</h2>
<p class="lede">Check everything below, then finish to enter play.</p>
<dl class="review">
  <dt><button type="button" class="jump" onclick={() => onJump('origin')}>Name</button></dt>
  <dd>{sheet.identity.character_name || '—'}{sheet.identity.pronouns ? ` (${sheet.identity.pronouns})` : ''}</dd>
  <dt><button type="button" class="jump" onclick={() => onJump('background')}>Background</button></dt>
  <dd>{playbook.backgrounds.find((b) => b.id === sheet.identity.background_id)?.name ?? '—'}</dd>
  <dt><button type="button" class="jump" onclick={() => onJump('instinct')}>Instinct</button></dt>
  <dd>
    {#if chosenInstinct?.custom}
      {sheet.identity.instinct_write_in || '—'}
    {:else}
      {chosenInstinct?.label ?? '—'}
    {/if}
  </dd>
  <dt><button type="button" class="jump" onclick={() => onJump('appearance')}>Appearance</button></dt>
  <dd>{Object.values(sheet.identity.appearance).filter(Boolean).join(' · ') || '—'}</dd>
  <dt><button type="button" class="jump" onclick={() => onJump('origin')}>Origin</button></dt>
  <dd>{playbook.origins.find((o) => o.id === sheet.identity.origin_id)?.label ?? '—'}</dd>
  <dt><button type="button" class="jump" onclick={() => onJump('stats')}>Stats</button></dt>
  <dd>{STAT_KEYS.map((s) => `${s} ${sheet.mechanics.stats[s] >= 0 ? '+' : ''}${sheet.mechanics.stats[s] ?? 0}`).join(' · ')}</dd>
  <dt>HP</dt>
  <dd>{sheet.mechanics.hp_current}/{sheet.mechanics.max_hp} · Damage {sheet.mechanics.damage_die}</dd>
  <dt><button type="button" class="jump" onclick={() => onJump('moves')}>Moves</button></dt>
  <dd>{sheet.moves.selected.map((id) => playbook.moves.find((m) => m.id === id)?.name ?? id).join(', ') || '—'}</dd>
  <dt><button type="button" class="jump" onclick={() => onJump('possessions')}>Possessions</button></dt>
  <dd>
    {sheet.possessions.selected
      .map((id) =>
        id === 'custom'
          ? sheet.possessions.custom || 'Custom'
          : (possessions.options ?? []).find((o) => o.id === id)?.name ?? id,
      )
      .join(', ') || '—'}
  </dd>
</dl>
{#if !readyToFinish(playbook, sheet)}
  <p class="warn">! Some required steps aren't complete yet — go back and finish them before starting play.</p>
  <ul class="issue-list">
    {#each WIZARD_STEPS as s}
      {#if s.id !== 'review' && s.id !== 'details' && s.id !== 'introductions' && s.id !== 'appearance' && !stepValid(s.id, playbook, sheet)}
        <li>
          <button type="button" class="jump" onclick={() => onJump(s.id)}>{s.label} incomplete</button>
        </li>
      {/if}
    {/each}
  </ul>
{/if}
