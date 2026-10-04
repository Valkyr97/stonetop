<script lang="ts">
  import { onDestroy } from 'svelte'
  import { link } from 'svelte-spa-router'
  import AppShell from '../lib/components/AppShell.svelte'
  import Wizard from '../lib/sheet/wizard/Wizard.svelte'
  import PlayMode from '../lib/sheet/play/PlayMode.svelte'
  import SyncButton from '../lib/components/SyncButton.svelte'
  import { getArcanaPack, getCreationPack } from '../lib/content/packLoader'
  import type { ArcanaCard, CharacterState, InsertDef, Playbook } from '../lib/content/types'
  import {
    getArcanaStatesForCharacter,
    getCharacterDraft,
    getGrantsForCharacter,
    saveArcanaStateLocal,
    saveCharacterDraft,
    type LocalArcanaState,
    type LocalCharacterDraft,
    type LocalGrant,
  } from '../lib/db/idb'
  import { migrateCharacterState, needsMigration } from '../lib/sheet/engine'
  import { syncTrackers } from '../lib/sheet/engine/trackers'
  import { syncAll } from '../lib/sync/syncAll'

  let { params = {} }: { params?: { id?: string } } = $props()

  let draft = $state<LocalCharacterDraft | null>(null)
  let playbook = $state<Playbook | null>(null)
  let inserts = $state<InsertDef[]>([])
  let grants = $state<LocalGrant[]>([])
  let arcanaCards = $state<ArcanaCard[]>([])
  let arcanaStates = $state<LocalArcanaState[]>([])
  let error = $state('')
  let notice = $state('')
  let sheetMode = $state<'play' | 'edit'>('play')

  function plainClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }

  $effect(() => {
    const id = params.id
    if (!id) return
    let cancelled = false
    void load(id, () => cancelled)
    return () => {
      cancelled = true
    }
  })

  onDestroy(() => {
    if (!draft) return
    void saveCharacterDraft(plainClone(draft))
  })

  async function load(id: string, isCancelled: () => boolean = () => false) {
    error = ''
    try {
      const local = await getCharacterDraft(id)
      if (isCancelled()) return
      if (!local) {
        error = 'This character sheet was not found on this device.'
        draft = null
        return
      }
      draft = local

      if (draft.claim && navigator.onLine) {
        try {
          await syncAll([draft.claim.characterId])
          if (isCancelled()) return
          draft = (await getCharacterDraft(id)) ?? draft
        } catch {
          // keep local
        }
      }
      if (isCancelled()) return

      // Upgrade pre-schema-v2 drafts so play/wizard see a consistent shape.
      if (needsMigration(draft.state)) {
        const migrated = migrateCharacterState(draft.state)
        const updated = {
          ...draft,
          state: migrated as unknown as Record<string, unknown>,
          dirty: true,
          updatedAt: new Date().toISOString(),
        }
        await saveCharacterDraft(updated)
        if (isCancelled()) return
        draft = updated
      }

      const pack = await getCreationPack()
      if (isCancelled()) return
      playbook = pack.content.playbooks.find((p) => p.id === draft!.playbookId) ?? null
      inserts = pack.content.inserts

      // Drop take-count boxes (Improved Stat etc.) from play trackers.
      if (playbook && (draft.state as unknown as CharacterState).creation_complete) {
        const state = draft.state as unknown as CharacterState
        const nextTrackers = syncTrackers(state, playbook)
        if (JSON.stringify(nextTrackers) !== JSON.stringify(state.mechanics.trackers ?? {})) {
          const updated = {
            ...draft,
            state: {
              ...state,
              mechanics: { ...state.mechanics, trackers: nextTrackers },
            } as unknown as Record<string, unknown>,
            dirty: true,
            updatedAt: new Date().toISOString(),
          }
          await saveCharacterDraft(updated)
          if (isCancelled()) return
          draft = updated
        }
      }
      const arcana = await getArcanaPack()
      if (isCancelled()) return
      arcanaCards = [...(arcana?.arcana.minor ?? []), ...(arcana?.arcana.major ?? [])]
      grants = await getGrantsForCharacter(id)
      if (isCancelled()) return
      arcanaStates = await getArcanaStatesForCharacter(id)
    } catch (e) {
      if (!isCancelled()) error = (e as Error).message
    }
  }

  async function persist(next: CharacterState) {
    if (!draft) return
    try {
      const state = plainClone(next) as unknown as Record<string, unknown>
      const name = next.identity?.character_name?.trim() || draft.name
      const updatedAt = new Date().toISOString()
      // Mutate in place so the wizard is not remounted (replacing `draft`
      // would reset the step and drop in-progress creation).
      draft.state = state
      draft.name = name
      draft.dirty = true
      draft.updatedAt = updatedAt
      notice = 'Saved locally'
      await saveCharacterDraft(
        plainClone({
          ...draft,
          state,
          name,
          dirty: true,
          updatedAt,
        }),
      )
      error = ''
    } catch (e) {
      error = (e as Error).message
    }
  }

  async function persistArcana(next: LocalArcanaState) {
    await saveArcanaStateLocal(next)
    arcanaStates = arcanaStates.map((s) => (s.id === next.id ? next : s))
    notice = 'Arcana saved locally'
  }
</script>

<AppShell>
  <div class="top">
    <a href="#/" use:link>← Home</a>
    {#if draft?.claim}
      <span class="mesa">Table: {draft.claim.campaignName}</span>
      <SyncButton characterIds={[draft.claim.characterId]} />
    {:else if draft}
      <span class="mesa muted">No table yet · join one from Home</span>
    {/if}
  </div>
  {#if error}<p class="err">! {error}</p>{/if}
  {#if notice}<p class="ok">{notice}</p>{/if}

  {#if draft && playbook}
    {#key params.id ?? draft.id}
      {#if !(draft.state as unknown as CharacterState).creation_complete}
        <Wizard
          {playbook}
          {inserts}
          sheet={draft.state as unknown as CharacterState}
          onchange={persist}
        />
      {:else}
        <div class="mode-bar" role="group" aria-label="Sheet mode">
          <button
            type="button"
            class="mode-btn"
            class:on={sheetMode === 'play'}
            onclick={() => (sheetMode = 'play')}
          >Play</button>
          <button
            type="button"
            class="mode-btn"
            class:on={sheetMode === 'edit'}
            onclick={() => (sheetMode = 'edit')}
          >Edit</button>
        </div>
        <PlayMode
          {playbook}
          {inserts}
          sheet={draft.state as unknown as CharacterState}
          mode={sheetMode}
          {grants}
          {arcanaCards}
          {arcanaStates}
          onchange={persist}
          onArcanaStateChange={persistArcana}
          onRequestEdit={() => {
            sheetMode = 'edit'
          }}
        />
      {/if}
    {/key}
  {:else if !error}
    <p>Loading character…</p>
  {/if}
</AppShell>

<style>
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    font-size: 0.9rem;
  }
  .mesa {
    margin-left: auto;
    font-size: 0.85rem;
  }
  .muted {
    color: var(--ink-muted);
  }
  .err {
    color: var(--danger);
  }
  .ok {
    color: var(--accent);
    font-size: 0.85rem;
  }
  .mode-bar {
    display: inline-flex;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
    padding: 0.2rem;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--paper-2);
  }
  .mode-btn {
    font: inherit;
    font-size: 0.88rem;
    padding: 0.35rem 0.85rem;
    border: 0;
    border-radius: calc(var(--radius, 8px) - 2px);
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
  }
  .mode-btn.on {
    background: var(--accent);
    color: var(--paper, #fff);
    color: var(--ink-on-accent, #fff);
  }
</style>
