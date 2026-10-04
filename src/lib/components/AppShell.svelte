<script lang="ts">
  import { link, location, push } from 'svelte-spa-router'
  import { profile, signOut, user } from '../auth'
  import { theme, toggleTheme } from '../theme'

  interface Props {
    children?: import('svelte').Snippet
  }

  let { children }: Props = $props()
</script>

<div class="shell">
  <header>
    <a href="#/" use:link class="brand">
      <img src="/icons/pwa-192.png" alt="" width="32" height="32" />
      Stonetop
    </a>
    <nav>
      {#if $user}
        <a href="#/gm" use:link class:active={$location.startsWith('/gm')}>GM</a>
        <span class="who">{$profile?.display_name ?? $user.email}</span>
        <button type="button" onclick={() => signOut().then(() => push('/'))}>Sign out</button>
      {:else}
        <a href="#/login" use:link class:active={$location === '/login'}>GM access</a>
      {/if}
      <button
        type="button"
        class="theme-toggle"
        onclick={toggleTheme}
        aria-label={$theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {$theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </nav>
  </header>
  <div class="body">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>

<style>
  .shell {
    min-height: 100vh;
    background: var(--paper);
    color: var(--ink);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid var(--line);
    background: var(--paper-2);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.35rem;
    text-decoration: none;
    color: var(--ink);
  }
  .brand img {
    display: block;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: #f4efe4;
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }
  nav a {
    color: var(--ink-muted);
    text-decoration: none;
  }
  nav a.active {
    color: var(--accent);
    font-weight: 600;
  }
  .who {
    font-size: 0.85rem;
    color: var(--ink-muted);
  }
  button {
    border: 1px solid var(--line);
    background: var(--paper-2);
    color: var(--ink);
    border-radius: var(--radius);
    padding: var(--btn-pad-y) var(--btn-pad-x);
    min-height: var(--btn-min);
    font: inherit;
    cursor: pointer;
  }
  button:hover {
    border-color: var(--accent);
  }
  .theme-toggle {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
  }
  .body {
    max-width: 64rem;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 2.5rem;
  }
</style>
