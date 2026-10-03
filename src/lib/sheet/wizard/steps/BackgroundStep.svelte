<script lang="ts">
  import type { Background, CharacterState, Playbook } from '../../../content/types'
  import BackgroundCard from '../../../components/BackgroundCard.svelte'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    readonly?: boolean
    onSelect: (bg: Background) => void
    onFieldChange: (bg: Background, key: string, value: unknown) => void
  }

  let { playbook, sheet, readonly = false, onSelect, onFieldChange }: Props = $props()

  const backgroundFieldValues = $derived(
    (sheet.setup.background_fields as Record<string, unknown> | undefined) ?? {},
  )
</script>

<h2>Background <span class="req">choose 1</span></h2>
<p class="lede">
  Pick the background that shaped your character before Stonetop. Read the full text — it grants a
  move and sets up fields below.
</p>
<div class="choices">
  {#each playbook.backgrounds as bg}
    <BackgroundCard
      background={bg}
      {playbook}
      selected={sheet.identity.background_id === bg.id}
      disabled={readonly}
      fieldValues={sheet.identity.background_id === bg.id ? backgroundFieldValues : {}}
      onSelect={() => onSelect(bg)}
      onFieldChange={(key, value) => onFieldChange(bg, key, value)}
    />
  {/each}
</div>
