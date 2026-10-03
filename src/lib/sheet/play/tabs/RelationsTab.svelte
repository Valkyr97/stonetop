<script lang="ts">
  import type { CharacterState, Playbook } from '../../../content/types'
  import type { PatchSheet } from '../../sheetPatch'
  import Field from '../../../components/Field.svelte'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    readonly?: boolean
    patch: PatchSheet
  }

  let { playbook, sheet, readonly = false, patch }: Props = $props()

  const introAnswers = $derived(
    ((sheet.setup.introductions as Record<string, string> | undefined) ?? {}) as Record<string, string>,
  )
  const npcConnections = $derived(sheet.session_zero_notes.npc_connections ?? [])
  const pcConnections = $derived(sheet.session_zero_notes.pc_connections ?? [])
  const characterNotes = $derived(String((sheet.setup.notes as string | undefined) ?? ''))

  function setIntroAnswer(n: string, value: string) {
    patch((d) => {
      d.setup.introductions = { ...((d.setup.introductions as object) ?? {}), [n]: value }
      if (n === '2') d.session_zero_notes.contribution_to_stonetop = value
    })
  }

  function ensureRows() {
    patch((d) => {
      const prompts = playbook.introductions?.npc_prompts ?? []
      if (!d.session_zero_notes.npc_connections?.length && prompts.length) {
        d.session_zero_notes.npc_connections = prompts.map((p, i) => ({
          prompt_id: `npc-${i}`,
          answer_name: '',
          notes: p,
        }))
      }
      const pcPrompts = playbook.introductions?.pc_prompts ?? []
      if (!d.session_zero_notes.pc_connections?.length && pcPrompts.length) {
        d.session_zero_notes.pc_connections = pcPrompts.map((p, i) => ({
          prompt_id: `pc-${i}`,
          target_character_id: null,
          target_character_name: '',
          notes: p,
        }))
      }
    })
  }

  function setName(kind: 'npc' | 'pc', index: number, name: string) {
    patch((d) => {
      if (kind === 'npc') {
        const rows = [...(d.session_zero_notes.npc_connections ?? [])]
        if (!rows[index]) return
        rows[index] = { ...rows[index], answer_name: name }
        d.session_zero_notes.npc_connections = rows
      } else {
        const rows = [...(d.session_zero_notes.pc_connections ?? [])]
        if (!rows[index]) return
        rows[index] = { ...rows[index], target_character_name: name }
        d.session_zero_notes.pc_connections = rows
      }
    })
  }

  function addRow(kind: 'npc' | 'pc') {
    patch((d) => {
      if (kind === 'npc') {
        d.session_zero_notes.npc_connections = [
          ...(d.session_zero_notes.npc_connections ?? []),
          { prompt_id: `npc-${Date.now()}`, answer_name: '', notes: '' },
        ]
      } else {
        d.session_zero_notes.pc_connections = [
          ...(d.session_zero_notes.pc_connections ?? []),
          {
            prompt_id: `pc-${Date.now()}`,
            target_character_id: null,
            target_character_name: '',
            notes: '',
          },
        ]
      }
    })
  }
</script>

<h2>Relations</h2>
<p class="lede">Introductions, bonds, and free notes for this PC.</p>

{#if playbook.introductions?.steps?.length}
  <h3>Introductions</h3>
  {#each playbook.introductions.steps as step (step.n)}
    <Field
      label={`Step ${step.n}`}
      value={introAnswers[String(step.n)] ?? ''}
      disabled={readonly}
      onchange={(v) => setIntroAnswer(String(step.n), String(v))}
    />
    {#if step.text}
      <p class="hint">{step.text}</p>
    {/if}
  {/each}
{/if}

<h3>NPC connections</h3>
{#if !npcConnections.length && !readonly}
  <button type="button" class="action ghost" onclick={() => ensureRows()}>
    Load prompts from playbook
  </button>
{/if}
{#each npcConnections as row, i}
  <div class="relation-row">
    {#if row.notes}
      <p class="hint">{row.notes}</p>
    {/if}
    <Field
      label="Name"
      value={row.answer_name}
      disabled={readonly}
      onchange={(v) => setName('npc', i, String(v))}
    />
  </div>
{/each}
{#if !readonly}
  <button type="button" class="action ghost" onclick={() => addRow('npc')}>+ NPC</button>
{/if}

<h3>PC connections</h3>
{#if !pcConnections.length && !readonly}
  <button type="button" class="action ghost" onclick={() => ensureRows()}>
    Load prompts from playbook
  </button>
{/if}
{#each pcConnections as row, i}
  <div class="relation-row">
    {#if row.notes}
      <p class="hint">{row.notes}</p>
    {/if}
    <Field
      label="PC name"
      value={row.target_character_name ?? ''}
      disabled={readonly}
      onchange={(v) => setName('pc', i, String(v))}
    />
  </div>
{/each}
{#if !readonly}
  <button type="button" class="action ghost" onclick={() => addRow('pc')}>+ PC</button>
{/if}

<h3>Notes</h3>
<Field
  label="Character notes"
  value={characterNotes}
  disabled={readonly}
  onchange={(v) => patch((d) => { d.setup.notes = String(v) })}
/>

<style>
  h2 { margin: 0 0 0.5rem; font-family: var(--font-display); font-weight: 400; }
  h3 { margin: 1rem 0 0.4rem; font-size: 0.95rem; }
  .relation-row {
    display: grid; gap: 0.35rem; margin-bottom: 0.85rem; padding-bottom: 0.65rem;
    border-bottom: 1px solid var(--line);
  }
  .action { margin-top: 0.55rem; }
</style>
