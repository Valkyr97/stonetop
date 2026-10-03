<script lang="ts">
  import type { CharacterState, Playbook } from '../../../content/types'
  import type { PatchSheet } from '../../sheetPatch'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    readonly?: boolean
    patch: PatchSheet
  }

  let { playbook, sheet, readonly = false, patch }: Props = $props()
</script>

<h2>Appearance</h2>
<p class="lede">Optional — pick from each line, write your own, or skip.</p>
<div class="appearance-lines">
  {#each playbook.appearance_groups as group}
    <div class="appearance-line" role="group" aria-label={group.id}>
      {#each group.options as opt}
        {@const on =
          sheet.identity.appearance[group.id] === opt.label ||
          sheet.identity.appearance[group.id] === opt.id}
        <button
          type="button"
          class="pill"
          class:on
          disabled={readonly}
          aria-pressed={on}
          onclick={() => patch((d) => { d.identity.appearance[group.id] = opt.label })}
        >
          {opt.label}
        </button>
      {/each}
      {#if group.type.includes('custom')}
        {@const customOn =
          !!sheet.identity.appearance[group.id] &&
          !group.options.some(
            (o) =>
              o.label === sheet.identity.appearance[group.id] ||
              o.id === sheet.identity.appearance[group.id],
          )}
        <input
          class="pill-custom"
          class:on={customOn}
          type="text"
          placeholder="Write your own…"
          disabled={readonly}
          value={customOn ? sheet.identity.appearance[group.id] : ''}
          oninput={(e) => patch((d) => { d.identity.appearance[group.id] = e.currentTarget.value })}
        />
      {/if}
    </div>
  {/each}
</div>
