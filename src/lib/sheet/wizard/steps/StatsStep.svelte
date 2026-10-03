<script lang="ts">
  import type { CharacterState, Playbook } from '../../../content/types'
  import {
    STAT_KEYS,
    formatStatMod,
    isStatArrayComplete,
    remainingStatValues,
    type StatAssignments,
    type StatKey,
  } from '../../engine/stats'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    readonly?: boolean
    onToggle: (stat: StatKey, value: number) => void
  }

  let { playbook, sheet, readonly = false, onToggle }: Props = $props()

  const array = $derived(playbook.base.stat_array)
  const distinct = $derived([...new Set(array)].sort((a, b) => b - a))
  const assignments = $derived(
    ((sheet.setup.stat_base as StatAssignments | undefined) ?? {}) as StatAssignments,
  )
  const complete = $derived(isStatArrayComplete(array, assignments))
</script>

<h2>Assign your stats</h2>
<p class="lede">
  Spend the array
  <span class="stat-array">{array.map(formatStatMod).join(', ')}</span>
  — one value per stat. Damage {playbook.base.damage_die} · Max HP {playbook.base.max_hp}.
</p>
<div class="stat-assign">
  {#each STAT_KEYS as stat}
    {@const current = assignments[stat]}
    {@const available = remainingStatValues(array, assignments, stat)}
    <div class="stat-row">
      <span class="stat-key">{stat}</span>
      <div class="stat-values">
        {#each distinct as value}
          {@const on = current === value && stat in assignments}
          <button
            type="button"
            class="stat-value"
            class:on
            disabled={readonly || (!on && !available.includes(value))}
            aria-pressed={on}
            onclick={() => onToggle(stat, value)}
          >
            {formatStatMod(value)}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>
<p class="stat-status" class:ready={complete} class:warn={!complete}>
  {#if complete}
    All stats assigned.
  {:else}
    ! Assign every stat to continue.
  {/if}
</p>
