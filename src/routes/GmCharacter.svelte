<script lang="ts">
  import { onMount } from 'svelte'
  import { link } from 'svelte-spa-router'
  import AppShell from '../lib/components/AppShell.svelte'
  import PlayMode from '../lib/sheet/play/PlayMode.svelte'
  import { grantContent, updateGrantVisibility } from '../lib/campaigns'
  import { getArcanaPack, getCreationPack } from '../lib/content/packLoader'
  import type { ArcanaCard, CharacterState, InsertDef, Playbook } from '../lib/content/types'
  import { getArcanaStatesForCharacter, getGrantsForCharacter, type LocalGrant } from '../lib/db/idb'
  import { migrateCharacterState } from '../lib/sheet/engine'
  import { pullGrantsForCharacter } from '../lib/sync/pullGrants'
  import { supabase } from '../lib/supabase'
  import type { Character, ContentGrant } from '../lib/database.types'

  let { params = {} }: { params?: { id?: string } } = $props()

  // Avoid naming any binding `state` — collides with the `$state` rune.
  let character = $state<Character | null>(null)
  let playbook = $state<Playbook | null>(null)
  let inserts = $state<InsertDef[]>([])
  let sheet = $state<CharacterState | null>(null)
  let grants = $state<LocalGrant[]>([])
  let remoteGrants = $state<ContentGrant[]>([])
  let arcanaCards = $state<ArcanaCard[]>([])
  let arcanaStates = $state<any[]>([])
  let grantKind = $state<'arcana' | 'insert'>('arcana')
  let selectedArcana = $state('')
  let selectedInsert = $state('')
  let visibility = $state<'front_only' | 'full'>('full')
  let error = $state('')
  let busy = $state(false)

  const manualInserts = $derived(inserts.filter((i) => i.manual))

  onMount(async () => {
    const id = params.id
    if (!id) return
    try {
      const { data, error: err } = await supabase.from('characters').select('*').eq('id', id).single()
      if (err) throw err
      character = data
      sheet = migrateCharacterState(data.state)
      const pack = await getCreationPack()
      playbook = pack.content.playbooks.find((p) => p.id === data.playbook_id) ?? null
      inserts = pack.content.inserts
      const arcana = await getArcanaPack()
      arcanaCards = [...(arcana?.arcana.minor ?? []), ...(arcana?.arcana.major ?? [])]
      if (arcanaCards[0]) selectedArcana = arcanaCards[0].id
      const manuals = inserts.filter((i) => i.manual)
      if (manuals[0]) selectedInsert = manuals[0].id
      await pullGrantsForCharacter(id)
      grants = await getGrantsForCharacter(id)
      arcanaStates = await getArcanaStatesForCharacter(id)
      const { data: rg } = await supabase.from('content_grants').select('*').eq('character_id', id)
      remoteGrants = rg ?? []
    } catch (e) {
      error = (e as Error).message
    }
  })

  async function refreshGrants() {
    if (!character) return
    await pullGrantsForCharacter(character.id)
    grants = await getGrantsForCharacter(character.id)
    arcanaStates = await getArcanaStatesForCharacter(character.id)
    const { data: rg } = await supabase
      .from('content_grants')
      .select('*')
      .eq('character_id', character.id)
    remoteGrants = rg ?? []
  }

  async function onGrant() {
    if (!character) return
    busy = true
    error = ''
    try {
      if (grantKind === 'arcana') {
        if (!selectedArcana) throw new Error('Pick an arcana card')
        const card = arcanaCards.find((c: ArcanaCard) => c.id === selectedArcana)
        if (!card) throw new Error('Arcana not found')
        await grantContent({
          characterId: character.id,
          contentType: card.type === 'major_arcanum' ? 'arcana_major' : 'arcana_minor',
          contentId: card.id,
          visibility,
        })
      } else {
        if (!selectedInsert) throw new Error('Pick an insert')
        await grantContent({
          characterId: character.id,
          contentType: 'insert',
          contentId: selectedInsert,
          visibility: 'full',
        })
      }
      await refreshGrants()
    } catch (e) {
      error = (e as Error).message
    } finally {
      busy = false
    }
  }

  async function toggleVisibility(grant: ContentGrant) {
    const next = grant.visibility === 'full' ? 'front_only' : 'full'
    await updateGrantVisibility(grant.id, next)
    await refreshGrants()
  }

  function grantLabel(g: ContentGrant): string {
    if (g.content_type === 'insert') {
      return inserts.find((i) => i.id === g.content_id)?.name ?? g.content_id
    }
    return arcanaCards.find((c) => c.id === g.content_id)?.name ?? g.content_id
  }
</script>

<AppShell>
  {#if error}<p class="err">! {error}</p>{/if}
  {#if character && playbook && sheet}
    <p>
      <a href={`#/gm/campaign/${character.campaign_id}`} use:link>← Campaign</a>
    </p>
    <h1>GM view · {playbook.name}</h1>

    <article class="panel">
      <h2>Hang content</h2>
      <p class="help">
        Arcana and manual inserts (Followers, Ghost, Revenant, Thrall) only appear on the player
        sheet after you hang them here.
      </p>

      <fieldset class="kind">
        <legend>What to hang</legend>
        <label class="radio">
          <input type="radio" bind:group={grantKind} value="arcana" />
          Arcana
        </label>
        <label class="radio">
          <input type="radio" bind:group={grantKind} value="insert" />
          Manual insert
        </label>
      </fieldset>

      {#if grantKind === 'arcana'}
        <label>
          Arcana
          <select bind:value={selectedArcana}>
            {#each arcanaCards as card}
              <option value={card.id}>{card.name}</option>
            {/each}
          </select>
        </label>
        <label>
          Visibility
          <select bind:value={visibility}>
            <option value="front_only">Front only</option>
            <option value="full">Full</option>
          </select>
        </label>
      {:else}
        <label>
          Insert
          <select bind:value={selectedInsert}>
            {#each manualInserts as insert}
              <option value={insert.id}>{insert.name}</option>
            {/each}
          </select>
        </label>
        <p class="help">Manual inserts unlock at full visibility (player can attach via +).</p>
      {/if}

      <button type="button" disabled={busy} onclick={onGrant}>Hang on character</button>

      <h3>Granted</h3>
      {#if remoteGrants.length === 0}
        <p class="help">Nothing hung yet.</p>
      {:else}
        <ul>
          {#each remoteGrants as g}
            <li>
              <span class="grant-type">{g.content_type}</span>
              · {grantLabel(g)}
              · {g.visibility}
              {#if g.content_type.startsWith('arcana')}
                <button type="button" class="small" onclick={() => toggleVisibility(g)}>
                  Switch to {g.visibility === 'full' ? 'front_only' : 'full'}
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </article>

    {#key character.id}
      <PlayMode
        {playbook}
        {inserts}
        {sheet}
        {grants}
        {arcanaCards}
        {arcanaStates}
        readonly
        onchange={() => {}}
      />
    {/key}
  {:else}
    <p>Loading…</p>
  {/if}
</AppShell>

<style>
  .panel {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
    background: rgba(255, 255, 255, 0.65);
  }
  .help {
    color: var(--ink-muted);
    font-size: 0.9rem;
    margin: 0 0 0.75rem;
  }
  .kind {
    border: 0;
    padding: 0;
    margin: 0 0 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .kind legend {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink-muted);
    margin-bottom: 0.35rem;
    width: 100%;
  }
  .radio {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.95rem;
  }
  label:not(.radio) {
    display: grid;
    gap: 0.35rem;
    margin-bottom: 0.75rem;
  }
  select,
  button {
    font: inherit;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
  }
  button {
    background: var(--accent);
    color: white;
    border: 0;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .small {
    margin-left: 0.5rem;
    padding: 0.2rem 0.45rem;
    font-size: 0.8rem;
  }
  .grant-type {
    font-family: ui-monospace, monospace;
    font-size: 0.82rem;
  }
  h3 {
    margin: 1rem 0 0.4rem;
    font-size: 0.95rem;
  }
  ul {
    padding-left: 1.1rem;
    margin: 0;
  }
  .err {
    color: var(--danger);
  }
</style>
