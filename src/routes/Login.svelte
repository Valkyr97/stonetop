<script lang="ts">
  import { link, push } from 'svelte-spa-router'
  import { signIn, signUp } from '../lib/auth'
  import AppShell from '../lib/components/AppShell.svelte'

  let mode = $state<'login' | 'register'>('login')
  let email = $state('')
  let password = $state('')
  let displayName = $state('')
  let error = $state('')
  let busy = $state(false)

  async function submit(e: Event) {
    e.preventDefault()
    busy = true
    error = ''
    try {
      if (mode === 'login') await signIn(email, password)
      else await signUp(email, password, displayName || email.split('@')[0])
      push('/gm')
    } catch (err) {
      error = (err as Error).message
    } finally {
      busy = false
    }
  }
</script>

<AppShell>
  <section class="card">
    <h1>Acceso GM</h1>
    <p class="help">
      Los jugadores no necesitan cuenta: crean su ficha en «Inicio» y la unen a la mesa con un código.
      Este acceso es solo para quien dirige la partida.
    </p>
    <p class="help">Proyecto Supabase aislado: <code>stonetop</code> (eu-west-1).</p>
    <form onsubmit={submit}>
      {#if mode === 'register'}
        <label>
          Nombre visible
          <input bind:value={displayName} autocomplete="nickname" />
        </label>
      {/if}
      <label>
        Email
        <input type="email" bind:value={email} required autocomplete="email" />
      </label>
      <label>
        Contraseña
        <input type="password" bind:value={password} required minlength="6" autocomplete="current-password" />
      </label>
      {#if error}<p class="err">! {error}</p>{/if}
      <button type="submit" disabled={busy}>{busy ? '…' : mode === 'login' ? 'Entrar' : 'Crear cuenta GM'}</button>
    </form>
    <p>
      {#if mode === 'login'}
        ¿Primera vez dirigiendo?
        <button type="button" class="link" onclick={() => (mode = 'register')}>Crear cuenta GM</button>
      {:else}
        ¿Ya tienes cuenta?
        <button type="button" class="link" onclick={() => (mode = 'login')}>Entrar</button>
      {/if}
    </p>
    <p><a href="#/" use:link>← Volver a Inicio</a></p>
  </section>
</AppShell>

<style>
  .card {
    max-width: 420px;
    margin: 2rem auto;
    padding: 1.5rem;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.7);
  }
  form {
    display: grid;
    gap: 0.75rem;
  }
  label {
    display: grid;
    gap: 0.35rem;
    font-size: 0.9rem;
  }
  input[type='email'],
  input[type='password'],
  input:not([type]) {
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    font: inherit;
  }
  button[type='submit'] {
    background: var(--accent);
    color: white;
    border: 0;
    border-radius: var(--radius);
    padding: var(--btn-pad-y) var(--btn-pad-x);
    min-height: var(--btn-min);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .link {
    background: none;
    border: 0;
    color: var(--accent);
    cursor: pointer;
    font: inherit;
    font-size: var(--text-sm);
    text-decoration: underline;
    min-height: 0;
    padding: 0;
  }
  .help,
  .err {
    font-size: var(--text-sm);
  }
  .err {
    color: var(--danger);
  }
</style>
