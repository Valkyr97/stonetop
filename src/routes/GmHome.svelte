<script lang="ts">
  import { onMount } from 'svelte'
  import { link, push } from 'svelte-spa-router'
  import AppShell from '../lib/components/AppShell.svelte'
  import { listMyCampaigns } from '../lib/campaigns'
  import { user } from '../lib/auth'
  import type { Campaign } from '../lib/database.types'

  let campaigns = $state<Campaign[]>([])
  let error = $state('')

  onMount(async () => {
    if (!$user) {
      push('/login')
      return
    }
    try {
      campaigns = await listMyCampaigns()
    } catch (e) {
      error = (e as Error).message
    }
  })
</script>

<AppShell>
  <h1>Campañas (GM)</h1>
  {#if error}<p class="err">! {error}</p>{/if}
  <p><a href="#/" use:link>Crear / unirse desde inicio</a></p>
  <ul>
    {#each campaigns as c}
      <li>
        <a href={`#/gm/campaign/${c.id}`} use:link>{c.name}</a>
        <code>{c.join_code}</code>
      </li>
    {/each}
  </ul>
</AppShell>

<style>
  code {
    margin-left: 0.5rem;
  }
  .err {
    color: var(--danger);
  }
</style>
