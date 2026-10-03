<script lang="ts">
  import type { CharacterState, Playbook } from '../../content/types'
  import type { WizardStepId } from './steps'

  interface Props {
    playbook: Playbook
    characterState: CharacterState
    onJump?: (stepId: WizardStepId) => void
    /** `inline` = mobile foldaway; `aside` = desktop sticky rail. */
    placement?: 'inline' | 'aside'
  }

  let { playbook, characterState, onJump, placement = 'inline' }: Props = $props()

  const background = $derived(
    playbook.backgrounds.find((b) => b.id === characterState.identity.background_id)?.name,
  )
  const instinct = $derived(
    playbook.instincts.find((i) => i.id === characterState.identity.instinct_id)?.label,
  )
  const origin = $derived(
    playbook.origins.find((o) => o.id === characterState.identity.origin_id)?.label,
  )
  const statSummary = $derived(
    Object.entries(characterState.mechanics.stats)
      .map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`)
      .join(' · ') || '—',
  )
  const moveNames = $derived(
    characterState.moves.selected
      .map((id) => playbook.moves.find((m) => m.id === id)?.name)
      .filter(Boolean)
      .join(', ') || '—',
  )
  const possessionCount = $derived(characterState.possessions.selected.length)

  type Row = { label: string; value: string; stepId: WizardStepId }

  const rows = $derived<Row[]>([
    { label: 'Name', value: characterState.identity.character_name || 'Not chosen yet', stepId: 'origin' },
    { label: 'Background', value: background ?? 'Not chosen yet', stepId: 'background' },
    { label: 'Instinct', value: instinct ?? 'Not chosen yet', stepId: 'instinct' },
    { label: 'Origin', value: origin ?? 'Not chosen yet', stepId: 'origin' },
    { label: 'Stats', value: statSummary, stepId: 'stats' },
    { label: 'Moves', value: moveNames, stepId: 'moves' },
    { label: 'Possessions', value: `${possessionCount} selected`, stepId: 'possessions' },
  ])
</script>

{#snippet body()}
  <dl class="rows">
    {#each rows as row}
      <div class="row">
        <dt>{row.label}</dt>
        <dd>
          {#if onJump}
            <button type="button" class="jump" onclick={() => onJump(row.stepId)} title="Go to {row.label}">
              {row.value}
            </button>
          {:else}
            {row.value}
          {/if}
        </dd>
      </div>
    {/each}
  </dl>
{/snippet}

<!-- Mobile foldaway OR desktop sticky — Wizard mounts both placements. -->
{#if placement === 'inline'}
  <details class="rail mobile">
    <summary>Your choices so far</summary>
    <div class="inner">{@render body()}</div>
  </details>
{:else}
  <aside class="rail desktop" aria-label="Your choices so far">
    <h2>Your choices so far</h2>
    {@render body()}
  </aside>
{/if}

<style>
  .rail {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper-2);
  }
  .mobile {
    margin-bottom: 1.25rem;
    padding: 0.85rem 1rem;
  }
  .mobile summary {
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .mobile .inner {
    margin-top: 0.75rem;
  }
  .desktop {
    position: sticky;
    top: 5rem;
    padding: 1rem;
  }
  .desktop h2 {
    margin: 0 0 0.75rem;
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 700;
  }
  .rows {
    margin: 0;
    display: grid;
    gap: 0.65rem;
  }
  .row {
    display: grid;
    gap: 0.15rem;
  }
  dt {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }
  dd {
    margin: 0;
    font-size: 0.88rem;
  }
  .jump {
    display: block;
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 0.15em;
  }
  .jump:hover {
    color: var(--accent);
  }
  @media (min-width: 960px) {
    .mobile {
      display: none;
    }
  }
  @media (max-width: 959px) {
    .desktop {
      display: none;
    }
  }
</style>
