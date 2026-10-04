<script lang="ts">
  import Router, { replace } from 'svelte-spa-router'
  import { wrap } from 'svelte-spa-router/wrap'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { authReady, initAuth, user } from './lib/auth'
  import Home from './routes/Home.svelte'
  import CharacterNew from './routes/CharacterNew.svelte'
  import LocalCharacter from './routes/LocalCharacter.svelte'
  import Login from './routes/Login.svelte'
  import GmHome from './routes/GmHome.svelte'
  import GmCampaign from './routes/GmCampaign.svelte'
  import GmCharacter from './routes/GmCharacter.svelte'

  const requireAuth = () => !!get(user)

  const routes = {
    '/': Home,
    '/character/new': CharacterNew,
    '/character/:id': LocalCharacter,
    '/login': Login,
    '/gm': wrap({
      component: GmHome,
      conditions: [requireAuth],
    }),
    '/gm/campaign/:id': wrap({
      component: GmCampaign,
      conditions: [requireAuth],
    }),
    '/gm/character/:id': wrap({
      component: GmCharacter,
      conditions: [requireAuth],
    }),
    '*': Home,
  }

  onMount(async () => {
    await initAuth()
  })

  function conditionsFailed() {
    replace('/login')
  }
</script>

{#if $authReady}
  <Router {routes} on:conditionsFailed={conditionsFailed} />
{:else}
  <p class="boot">
    <img src="/icons/pwa-192.png" alt="" width="48" height="48" />
    Cargando Stonetop…
  </p>
{/if}

<style>
  .boot {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    padding: 2rem;
    text-align: center;
    color: #5b4a37;
  }
  .boot img {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: #f4efe4;
  }
</style>
