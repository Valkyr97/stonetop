<script lang="ts">
  import { onMount } from 'svelte'
  import { link } from 'svelte-spa-router'
  import AppShell from '../lib/components/AppShell.svelte'
  import { listCampaignCharacters } from '../lib/campaigns'
  import { supabase } from '../lib/supabase'
  import type { Campaign, Character } from '../lib/database.types'

  let { params = {} }: { params?: { id?: string } } = $props()

  let campaign = $state<Campaign | null>(null)
  let characters = $state<Character[]>([])
  let error = $state('')

  onMount(async () => {
    const id = params.id
    if (!id) return
    try {
      const { data, error: cErr } = await supabase.from('campaigns').select('*').eq('id', id).single()
      if (cErr) throw cErr
      campaign = data
      characters = await listCampaignCharacters(id)
    } catch (e) {
      error = (e as Error).message
    }
  })

  function characterName(ch: Character) {
    const state = ch.state as { identity?: { character_name?: string } } | null
    return state?.identity?.character_name?.trim() || '(sin nombre)'
  }
</script>

<AppShell>
  {#if !campaign}
    <p>Cargando…</p>
  {:else}
    <section>
      <p><a href="#/gm" use:link>← Campañas</a></p>
      <h1>{campaign.name}</h1>
      <p class="code">
        Código para que los jugadores se unan: <strong>{campaign.join_code}</strong>
      </p>
      {#if error}<p class="err">! {error}</p>{/if}

      <article class="panel">
        <h2>Personajes ({characters.length})</h2>
        <p class="hint">
          Cada jugador crea su ficha en su dispositivo y la une a esta mesa con el código de arriba.
        </p>
        <ul>
          {#each characters as ch}
            <li>
              <a href={`#/gm/character/${ch.id}`} use:link>
                {characterName(ch)} · {ch.playbook_id}
              </a>
              <span class="muted">actualizado {new Date(ch.updated_at).toLocaleString()}</span>
            </li>
          {:else}
            <li class="muted">Aún no se ha unido ningún personaje.</li>
          {/each}
        </ul>
      </article>
    </section>
  {/if}
</AppShell>

<style>
  .panel {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1rem;
    margin: 1rem 0;
    background: rgba(255, 255, 255, 0.65);
  }
  .code {
    font-size: 1.05rem;
  }
  .hint {
    font-size: 0.85rem;
    color: var(--ink-muted);
  }
  ul {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  li {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .muted {
    color: var(--ink-muted);
    font-size: 0.85rem;
  }
  .err {
    color: var(--danger);
  }
</style>
