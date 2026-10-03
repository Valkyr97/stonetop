<script lang="ts">
  import type { CharacterState, InsertDef } from '../../../content/types'
  import type { PatchSheet } from '../../sheetPatch'
  import Field from '../../../components/Field.svelte'
  import { renderRuleProse } from '../../../content/renderProse'
  import AnimalCompanion from '../inserts/AnimalCompanion.svelte'
  import Crew from '../inserts/Crew.svelte'
  import InitiatesOfDanu from '../inserts/InitiatesOfDanu.svelte'
  import Invocations from '../inserts/Invocations.svelte'
  import Followers from '../inserts/Followers.svelte'
  import UndeadInsert from '../inserts/UndeadInsert.svelte'
  import Thrall from '../inserts/Thrall.svelte'

  const RICH_INSERT_IDS = new Set([
    'animal-companion',
    'crew',
    'initiates-of-danu',
    'invocations',
    'followers',
    'ghost',
    'revenant',
    'thrall',
  ])

  interface Props {
    insert: InsertDef
    insertId: string
    sheet: CharacterState
    readonly?: boolean
    patch: PatchSheet
    onDetach: (id: string) => void
  }

  let { insert, insertId, sheet, readonly = false, patch, onDetach }: Props = $props()

  function insertState(id: string): Record<string, unknown> {
    return (sheet.inserts[id] as Record<string, unknown> | undefined) ?? {}
  }

  function patchInsertState(id: string, next: Record<string, unknown>) {
    patch((d) => { d.inserts[id] = next })
  }
</script>

<h2>{insert.name}</h2>

{#if insertId === 'animal-companion'}
  <AnimalCompanion {insert} data={insertState(insertId)} {readonly}
    onchange={(v) => patchInsertState(insertId, v)} />
{:else if insertId === 'crew'}
  <Crew {insert} data={insertState(insertId)} backgroundId={sheet.identity.background_id} {readonly}
    onchange={(v) => patchInsertState(insertId, v)} />
{:else if insertId === 'initiates-of-danu'}
  <InitiatesOfDanu {insert} data={insertState(insertId)} {readonly}
    onchange={(v) => patchInsertState(insertId, v)} />
{:else if insertId === 'invocations'}
  <Invocations {insert} data={insertState(insertId)} level={sheet.mechanics.level} {readonly}
    onchange={(v) => patchInsertState(insertId, v)} />
{:else if insertId === 'followers'}
  <Followers {insert} data={insertState(insertId)} {readonly}
    onchange={(v) => patchInsertState(insertId, v)} />
{:else if insertId === 'ghost' || insertId === 'revenant'}
  <UndeadInsert {insert} data={insertState(insertId)} {readonly}
    onchange={(v) => patchInsertState(insertId, v)} />
{:else if insertId === 'thrall'}
  <Thrall {insert} data={insertState(insertId)} {readonly}
    onchange={(v) => patchInsertState(insertId, v)} />
{:else}
  {#if insert.rule_text}
    <div class="insert-prose">{@html renderRuleProse(insert.rule_text)}</div>
  {:else if insert.note}
    <p class="help">{insert.note}</p>
  {/if}
  <Field
    label="Notes"
    value={String((sheet.inserts[insertId] as Record<string, unknown> | undefined)?.notes ?? '')}
    disabled={readonly}
    onchange={(v) => patch((d) => {
      d.inserts[insertId] = { ...((d.inserts[insertId] as object) ?? {}), notes: v }
    })}
  />
{/if}

{#if RICH_INSERT_IDS.has(insertId) && insert.rule_text}
  <details class="rule-text-details">
    <summary>Rule text</summary>
    <div class="insert-prose">{@html renderRuleProse(insert.rule_text)}</div>
  </details>
{/if}

{#if insert.manual && !readonly}
  <button type="button" class="action danger" onclick={() => onDetach(insertId)}>
    Remove from sheet
  </button>
{/if}

<style>
  h2 { margin: 0 0 0.5rem; font-family: var(--font-display); font-weight: 400; }
  .insert-prose { margin-bottom: 0.55rem; }
  .rule-text-details {
    margin: 0.85rem 0; border: 1px solid var(--line); border-radius: var(--radius);
    padding: 0.5rem 0.75rem; background: var(--paper-2);
  }
  .rule-text-details summary { cursor: pointer; font-weight: 600; font-size: 0.88rem; color: var(--accent); }
  .rule-text-details .insert-prose { margin-top: 0.6rem; margin-bottom: 0; }
  .insert-prose :global(p) { margin: 0 0 0.5rem; }
  .insert-prose :global(strong) { font-weight: 700; }
  .insert-prose :global(em) { font-family: var(--font-body); font-style: italic; }
  .action {
    margin-top: 0.55rem;
  }
</style>
