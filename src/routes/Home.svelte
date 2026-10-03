<script lang="ts">
  import { onMount } from 'svelte'
  import { link, push } from 'svelte-spa-router'
  import AppShell from '../lib/components/AppShell.svelte'
  import SyncButton from '../lib/components/SyncButton.svelte'
  import { claimCharacter, softDeleteClaimedCharacter } from '../lib/claim'
  import { ensureContentPacks, contentStatus } from '../lib/content/packLoader'
  import {
    deleteCharacterDraft,
    ensureLocalClientId,
    getCharacterDraft,
    listActiveCharacterDrafts,
    saveCharacterDraft,
    softDeleteCharacterDraft,
    type LocalCharacterDraft,
  } from '../lib/db/idb'

  let characters = $state<LocalCharacterDraft[]>([])
  let packInfo = $state('')
  let error = $state('')
  let joiningId = $state<string | null>(null)
  let joinCode = $state('')
  let busy = $state(false)
  let deletingId = $state<string | null>(null)

  onMount(refresh)

  async function refresh() {
    try {
      await ensureContentPacks({ includeOptional: true })
      const status = await contentStatus()
      packInfo = `Content ${status.version} · ${status.packs.filter((p) => p.cached).length}/${status.packs.length} packs cached`
      characters = (await listActiveCharacterDrafts()).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      )
    } catch (e) {
      error = (e as Error).message
    }
  }

  function displayName(ch: LocalCharacterDraft) {
    return ch.name?.trim() || 'Unnamed'
  }

  function openJoin(id: string) {
    joiningId = joiningId === id ? null : id
    joinCode = ''
    error = ''
  }

  async function onJoin(ch: LocalCharacterDraft) {
    busy = true
    error = ''
    try {
      const draft = (await getCharacterDraft(ch.id)) ?? ch
      const localClientId = await ensureLocalClientId()
      const result = await claimCharacter({
        joinCode,
        playbookId: draft.playbookId,
        state: draft.state,
        contentVersion: draft.contentVersion,
        localClientId,
      })
      const oldId = draft.id
      const updated: LocalCharacterDraft = {
        ...draft,
        id: result.character_id,
        dirty: false,
        updatedAt: new Date().toISOString(),
        claim: {
          characterId: result.character_id,
          campaignId: result.campaign_id,
          campaignName: result.campaign_name,
          claimSecret: result.claim_secret,
        },
      }
      await saveCharacterDraft(updated)
      if (oldId !== result.character_id) await deleteCharacterDraft(oldId)
      joiningId = null
      joinCode = ''
      await refresh()
      push(`/character/${result.character_id}`)
    } catch (e) {
      error = (e as Error).message
    } finally {
      busy = false
    }
  }

  async function onDelete(ch: LocalCharacterDraft) {
    const label = displayName(ch)
    if (!confirm(`Delete ${label}? You can ask a GM to restore a claimed character from the table.`)) {
      return
    }
    busy = true
    deletingId = ch.id
    error = ''
    try {
      if (ch.claim) {
        try {
          await softDeleteClaimedCharacter(ch.claim.characterId, ch.claim.claimSecret)
        } catch (e) {
          // Still soft-delete locally if offline / RPC fails after user confirmed.
          error = `Server delete failed (${(e as Error).message}); removed locally.`
        }
      }
      await softDeleteCharacterDraft(ch.id)
      await refresh()
    } catch (e) {
      error = (e as Error).message
    } finally {
      busy = false
      deletingId = null
    }
  }
</script>

<AppShell>
  <section class="hub">
    <header class="hero">
      <h1 class="brand-display">Stonetop</h1>
      <p class="tagline">Your characters, kept on this device and synced to the table when you join one.</p>
      <div class="toolbar">
        <a href="#/character/new" use:link class="cta">+ Create a character</a>
        {#if characters.some((c) => c.claim)}
          <SyncButton characterIds={characters.filter((c) => c.claim).map((c) => c.id)} />
        {/if}
      </div>
      <p class="muted pack-info">{packInfo}</p>
      {#if error}<p class="err">! {error}</p>{/if}
    </header>

    <ul class="roster">
      {#each characters as ch}
        <li class="card">
          <div class="row">
            <a href={`#/character/${ch.id}`} use:link class="identity">
              <strong>{displayName(ch)}</strong>
              <span class="pb">{ch.playbookId}</span>
            </a>
            <div class="aside">
              {#if ch.claim}
                <span class="status linked">{ch.claim.campaignName}</span>
              {:else}
                <button type="button" class="linkish" onclick={() => openJoin(ch.id)}>
                  Join a table
                </button>
              {/if}
              {#if ch.dirty}<span class="dirty">unsynced</span>{/if}
              <button
                type="button"
                class="linkish danger"
                disabled={busy && deletingId === ch.id}
                onclick={() => onDelete(ch)}
              >
                Delete
              </button>
            </div>
          </div>
          {#if joiningId === ch.id && !ch.claim}
            <div class="join">
              <input
                bind:value={joinCode}
                placeholder="Table code"
                maxlength="6"
                aria-label="Table code"
              />
              <button type="button" disabled={busy || !joinCode.trim()} onclick={() => onJoin(ch)}>
                Join
              </button>
              <button type="button" class="ghost" onclick={() => (joiningId = null)}>Cancel</button>
            </div>
          {/if}
        </li>
      {:else}
        <li class="card empty">No characters on this device yet. Create your first one above.</li>
      {/each}
    </ul>

    <p class="gm-link"><a href="#/login" use:link>Running the game? GM access →</a></p>
  </section>
</AppShell>

<style>
  .hub {
    display: grid;
    gap: 1.75rem;
  }
  .hero {
    display: grid;
    gap: 0.6rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--line);
  }
  .hero h1 {
    margin: 0;
    font-size: 2.6rem;
  }
  .tagline {
    margin: 0;
    max-width: 34rem;
    color: var(--ink-muted);
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.85rem;
    margin-top: 0.5rem;
  }
  .cta {
    background: var(--accent);
    color: var(--accent-contrast);
    text-decoration: none;
    border-radius: var(--radius);
    padding: 0.6rem 1rem;
    font-weight: 600;
  }
  .pack-info {
    margin: 0.35rem 0 0;
    font-size: 0.8rem;
  }
  .roster {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: 0.85rem;
  }
  .card {
    padding: 0.9rem 1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper-2);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .identity {
    display: flex;
    flex-direction: column;
    color: var(--ink);
    text-decoration: none;
  }
  .pb {
    font-size: 0.8rem;
    color: var(--ink-muted);
    text-transform: capitalize;
  }
  .aside {
    margin-left: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .status {
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
  .status.linked {
    color: var(--accent);
    font-weight: 600;
  }
  .dirty {
    font-size: 0.75rem;
    color: var(--warn);
  }
  .linkish {
    border: 1px solid var(--line);
    background: var(--paper);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.3rem 0.55rem;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .linkish.danger {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 40%, var(--line));
  }
  .join {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.65rem;
    padding-top: 0.65rem;
    border-top: 1px dashed var(--line);
  }
  .join input {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    text-transform: uppercase;
    width: 8rem;
  }
  .join button {
    background: var(--accent);
    color: var(--accent-contrast);
    border: 0;
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    font: inherit;
    cursor: pointer;
  }
  .join .ghost {
    background: transparent;
    color: var(--ink-muted);
    border: 1px solid var(--line);
  }
  .empty {
    color: var(--ink-muted);
    grid-column: 1 / -1;
  }
  .gm-link {
    margin-top: 0.5rem;
    font-size: 0.85rem;
  }
  .muted {
    color: var(--ink-muted);
  }
  .err {
    color: var(--danger);
  }
</style>
