<script lang="ts">
  import type { CharacterState, Playbook } from '../../../content/types'
  import type { PatchSheet } from '../../sheetPatch'
  import Field from '../../../components/Field.svelte'
  import SoftMd from '../../../components/SoftMd.svelte'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    mode?: 'play' | 'edit'
    readonly?: boolean
    patch: PatchSheet
  }

  let { playbook, sheet, mode = 'play', readonly = false, patch }: Props = $props()

  const editing = $derived(mode === 'edit' && !readonly)
  const introAnswers = $derived(
    ((sheet.setup.introductions as Record<string, string> | undefined) ?? {}) as Record<string, string>,
  )
  const npcConnections = $derived(sheet.session_zero_notes.npc_connections ?? [])
  const pcConnections = $derived(sheet.session_zero_notes.pc_connections ?? [])
  const characterNotes = $derived(String((sheet.setup.notes as string | undefined) ?? ''))

  function introNote(n: number | string): string {
    return String(introAnswers[String(n)] ?? '').trim()
  }

  function setIntroAnswer(n: string, value: string) {
    patch((d) => {
      d.setup.introductions = { ...((d.setup.introductions as object) ?? {}), [n]: value }
      if (n === '2') d.session_zero_notes.contribution_to_stonetop = value
    })
  }

  function patchNpc(index: number, next: Partial<(typeof npcConnections)[number]>) {
    patch((d) => {
      const rows = [...(d.session_zero_notes.npc_connections ?? [])]
      if (!rows[index]) return
      rows[index] = { ...rows[index], ...next }
      d.session_zero_notes.npc_connections = rows
    })
  }

  function patchPc(index: number, next: Partial<(typeof pcConnections)[number]>) {
    patch((d) => {
      const rows = [...(d.session_zero_notes.pc_connections ?? [])]
      if (!rows[index]) return
      rows[index] = { ...rows[index], ...next }
      d.session_zero_notes.pc_connections = rows
    })
  }

  function addRow(kind: 'npc' | 'pc') {
    patch((d) => {
      if (kind === 'npc') {
        d.session_zero_notes.npc_connections = [
          ...(d.session_zero_notes.npc_connections ?? []),
          { prompt_id: `npc-${Date.now()}`, answer_name: '', notes: '', nature: '' },
        ]
      } else {
        d.session_zero_notes.pc_connections = [
          ...(d.session_zero_notes.pc_connections ?? []),
          {
            prompt_id: `pc-${Date.now()}`,
            target_character_id: null,
            target_character_name: '',
            notes: '',
            nature: '',
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
    {@const note = introNote(step.n)}
    <div class="intro-step">
      <p class="step-label">Step {step.n}</p>
      {#if step.text}
        <div class="question"><SoftMd text={step.text} /></div>
      {/if}
      {#if step.questions?.length}
        <ul class="q-list">
          {#each step.questions as q}
            <li>{q}</li>
          {/each}
        </ul>
      {/if}
      {#if editing}
        <textarea
          class="intro-note"
          rows="2"
          placeholder="Notes (optional)…"
          value={introAnswers[String(step.n)] ?? ''}
          oninput={(e) => setIntroAnswer(String(step.n), e.currentTarget.value)}
        ></textarea>
      {:else if note}
        <p class="note-text">{note}</p>
      {/if}
    </div>
  {/each}
{/if}

<h3>NPC connections</h3>
{#each npcConnections as row, i}
  <div class="relation-row">
    {#if row.notes}
      <p class="hint">{row.notes}</p>
    {/if}
    {#if editing}
      <Field
        label="Name"
        value={row.answer_name}
        onchange={(v) => patchNpc(i, { answer_name: String(v) })}
      />
      <Field
        label="Nature of the relationship"
        value={row.nature ?? ''}
        onchange={(v) => patchNpc(i, { nature: String(v) })}
      />
    {:else}
      {#if row.answer_name}
        <p class="picked"><span class="k">Name</span> {row.answer_name}</p>
      {/if}
      {#if row.nature}
        <p class="picked"><span class="k">Nature</span> {row.nature}</p>
      {/if}
    {/if}
  </div>
{/each}
{#if editing}
  <button type="button" class="action ghost" onclick={() => addRow('npc')}>+ NPC</button>
{/if}

<h3>PC connections</h3>
{#each pcConnections as row, i}
  <div class="relation-row">
    {#if row.notes}
      <p class="hint">{row.notes}</p>
    {/if}
    {#if editing}
      <Field
        label="PC name"
        value={row.target_character_name ?? ''}
        onchange={(v) => patchPc(i, { target_character_name: String(v) })}
      />
      <Field
        label="Nature of the relationship"
        value={row.nature ?? ''}
        onchange={(v) => patchPc(i, { nature: String(v) })}
      />
    {:else}
      {#if row.target_character_name}
        <p class="picked"><span class="k">Name</span> {row.target_character_name}</p>
      {/if}
      {#if row.nature}
        <p class="picked"><span class="k">Nature</span> {row.nature}</p>
      {/if}
    {/if}
  </div>
{/each}
{#if editing}
  <button type="button" class="action ghost" onclick={() => addRow('pc')}>+ PC</button>
{/if}

<h3>Notes</h3>
{#if editing}
  <Field
    label="Character notes"
    value={characterNotes}
    onchange={(v) => patch((d) => { d.setup.notes = String(v) })}
  />
{:else if characterNotes.trim()}
  <p class="note-text">{characterNotes}</p>
{/if}

<style>
  h2 { margin: 0 0 0.5rem; font-family: var(--font-display); font-weight: 400; }
  h3 { margin: 1rem 0 0.4rem; font-size: 0.95rem; }
  .intro-step {
    display: grid; gap: 0.35rem; margin-bottom: 0.95rem; padding-bottom: 0.7rem;
    border-bottom: 1px solid var(--line);
  }
  .step-label {
    margin: 0; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.04em; color: var(--ink-muted);
  }
  .question :global(p) { margin: 0; }
  .q-list { margin: 0.15rem 0 0; padding-left: 1.2rem; font-size: 0.9rem; color: var(--ink-muted); }
  .intro-note {
    width: 100%; margin-top: 0.15rem; border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--paper); color: var(--ink); padding: 0.55rem 0.75rem; font: inherit;
    resize: vertical;
  }
  .note-text { margin: 0; white-space: pre-wrap; }
  .relation-row {
    display: grid; gap: 0.35rem; margin-bottom: 0.85rem; padding-bottom: 0.65rem;
    border-bottom: 1px solid var(--line);
  }
  .picked { margin: 0; }
  .k {
    font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--ink-muted); margin-right: 0.35rem;
  }
  .action { margin-top: 0.55rem; }
</style>
