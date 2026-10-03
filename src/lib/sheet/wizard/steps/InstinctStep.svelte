<script lang="ts">
  import type { CharacterState, Playbook } from '../../../content/types'
  import type { PatchSheet } from '../../sheetPatch'
  import ChoiceCard from '../../../components/ChoiceCard.svelte'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    readonly?: boolean
    patch: PatchSheet
    onSelect: (id: string) => void
  }

  let { playbook, sheet, readonly = false, patch, onSelect }: Props = $props()

  const chosenInstinct = $derived(
    playbook.instincts.find((i) => i.id === sheet.identity.instinct_id) ?? null,
  )
</script>

<h2>Choose an instinct</h2>
<p class="lede">The drive that gets you into trouble.</p>
<div class="choices two-col">
  {#each playbook.instincts as instinct}
    {#if instinct.custom}
      <ChoiceCard
        title={instinct.label || 'Write your own…'}
        selected={sheet.identity.instinct_id === instinct.id}
        disabled={readonly}
        onclick={() => onSelect(instinct.id)}
      />
    {:else}
      <ChoiceCard
        title={instinct.label}
        selected={sheet.identity.instinct_id === instinct.id}
        disabled={readonly}
        ruleText={instinct.description}
        onclick={() => onSelect(instinct.id)}
      />
    {/if}
  {/each}
</div>
{#if chosenInstinct?.custom}
  <input
    class="write-in"
    type="text"
    placeholder="Describe your instinct…"
    disabled={readonly}
    value={sheet.identity.instinct_write_in ?? ''}
    oninput={(e) => patch((d) => { d.identity.instinct_write_in = e.currentTarget.value })}
  />
{/if}
