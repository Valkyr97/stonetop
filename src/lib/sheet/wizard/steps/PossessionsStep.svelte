<script lang="ts">
  import type { CharacterState, Playbook } from '../../../content/types'
  import type { PatchSheet } from '../../sheetPatch'
  import ChoiceCard from '../../../components/ChoiceCard.svelte'
  import Field from '../../../components/Field.svelte'
  import { extraPossessionIds, playerPossessionPicks } from '../steps'

  interface PossessionItem {
    id: string
    name: string
    rule_text?: string | null
    state?: Record<string, unknown>
  }

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    readonly?: boolean
    patch: PatchSheet
    onToggle: (id: string) => void
    onWriteIn: (value: string) => void
  }

  let { playbook, sheet, readonly = false, patch, onToggle, onWriteIn }: Props = $props()

  const possessions = $derived(
    (playbook.special_possessions as {
      fixed?: PossessionItem[]
      choose?: number
      options?: PossessionItem[]
      sacred_pouch_setup?: Record<string, unknown>
    }) ?? {},
  )
  const extraIds = $derived(extraPossessionIds(sheet))
  const playerPicks = $derived(playerPossessionPicks(sheet))
  const atLimit = $derived((possessions.choose ?? 0) > 0 && playerPicks.length >= (possessions.choose ?? 0))
  const extraItems = $derived(
    (possessions.options ?? []).filter((item) => extraIds.has(item.id)),
  )
  const hasExtras = $derived((playbook.extras?.length ?? 0) > 0)
</script>

<h2>Possessions</h2>
<p class="lede">
  Choose {possessions.choose ?? 0}
  <span class="count-muted">({playerPicks.length}/{possessions.choose ?? 0})</span>
</p>
{#if possessions.fixed?.length}
  <h3>You carry</h3>
  <ul class="granted-list">
    {#each possessions.fixed as item}
      <li>{item.name}</li>
    {/each}
  </ul>
{/if}
{#if extraItems.length}
  <h3>From your background</h3>
  <div class="choices">
    {#each extraItems as item (item.id)}
      <ChoiceCard
        title={item.name}
        selected={true}
        disabled={true}
        ruleText={item.rule_text}
        fillSelected={true}
      />
    {/each}
  </div>
{/if}
<div class="choices">
  {#each possessions.options ?? [] as item}
    {#if extraIds.has(item.id)}
      <!-- Shown above as a background extra; does not consume the pick budget. -->
    {:else if item.id === 'custom'}
      <input
        class="write-in"
        type="text"
        placeholder="Something else (write-in)…"
        disabled={readonly || (atLimit && !sheet.possessions.selected.includes('custom'))}
        value={sheet.possessions.custom ?? ''}
        oninput={(e) => onWriteIn(e.currentTarget.value)}
      />
    {:else}
      <ChoiceCard
        title={item.name}
        selected={sheet.possessions.selected.includes(item.id)}
        disabled={readonly || (atLimit && !sheet.possessions.selected.includes(item.id))}
        ruleText={item.rule_text}
        onclick={() => onToggle(item.id)}
        fillSelected={true}
      />
      {#if sheet.possessions.selected.includes(item.id) && (item.state?.tag_choice as { options?: string[] } | undefined)?.options}
        <div class="nested">
          <p class="nested-label">Detail:</p>
          {#each (item.state?.tag_choice as { options: string[] }).options as opt}
            <label class="nested-opt">
              <input
                type="radio"
                name={`tag-${item.id}`}
                disabled={readonly}
                checked={String((sheet.possessions.details as Record<string, unknown>)?.[`${item.id}:tag`] ?? '') === opt}
                onchange={() => patch((d) => {
                  d.possessions.details = { ...(d.possessions.details ?? {}), [`${item.id}:tag`]: opt }
                })}
              />
              <span>{opt}</span>
            </label>
          {/each}
        </div>
      {/if}
    {/if}
  {/each}
</div>
{#if !hasExtras && possessions.sacred_pouch_setup}
  <h3>Sacred pouch</h3>
  {#each Object.entries(possessions.sacred_pouch_setup) as [key, val]}
    {#if Array.isArray(val)}
      <Field
        label={key}
        type="single_choice"
        options={val.map((x) => ({ id: String(x), label: String(x) }))}
        value={String((sheet.possessions.details as Record<string, unknown>)?.[key] ?? '')}
        disabled={readonly}
        onchange={(v) => patch((d) => {
          d.possessions.details = { ...(d.possessions.details ?? {}), [key]: v }
        })}
      />
    {:else if val && typeof val === 'object' && 'type' in (val as object) && (val as { type: string }).type === 'counter'}
      {@const stock = val as { type: string; initial?: number }}
      {@const max = stock.initial ?? 3}
      <Field
        label={key === 'stock' ? `Stock (max ${max} at start)` : key}
        type="checkbox_group"
        max={max}
        value={
          Array.isArray((sheet.possessions.details as Record<string, unknown>)?.[key])
            ? (sheet.possessions.details as Record<string, unknown>)[key]
            : Array.from({ length: max }, () => false)
        }
        disabled={readonly}
        onchange={(v) => patch((d) => {
          d.possessions.details = { ...(d.possessions.details ?? {}), [key]: v }
        })}
      />
    {:else if val && typeof val === 'object' && 'options' in (val as object)}
      {@const trait = val as { options?: string[] }}
      <Field
        label={key}
        type="single_choice"
        options={(trait.options ?? []).map((x) => ({ id: x, label: x }))}
        value={String((sheet.possessions.details as Record<string, unknown>)?.[key] ?? '')}
        disabled={readonly}
        onchange={(v) => patch((d) => {
          d.possessions.details = { ...(d.possessions.details ?? {}), [key]: v }
        })}
      />
    {/if}
  {/each}
{/if}
