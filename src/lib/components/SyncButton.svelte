<script lang="ts">
  import { syncAll, type SyncReport } from '../sync/syncAll'

  interface Props {
    characterIds?: string[]
  }

  let { characterIds }: Props = $props()
  let busy = $state(false)
  let report = $state<SyncReport | null>(null)
  let online = $state(typeof navigator !== 'undefined' ? navigator.onLine : true)

  function refreshOnline() {
    online = navigator.onLine
  }

  $effect(() => {
    window.addEventListener('online', refreshOnline)
    window.addEventListener('offline', refreshOnline)
    return () => {
      window.removeEventListener('online', refreshOnline)
      window.removeEventListener('offline', refreshOnline)
    }
  })

  async function run() {
    busy = true
    try {
      report = await syncAll(characterIds)
    } catch (e) {
      report = {
        ok: false,
        online: navigator.onLine,
        charactersSynced: 0,
        charactersPulled: 0,
        grantsPulled: 0,
        errors: [(e as Error).message],
      }
    } finally {
      busy = false
    }
  }
</script>

<div class="sync">
  <span class="badge" class:off={!online}>{online ? 'En línea' : 'Offline'}</span>
  <button type="button" onclick={run} disabled={busy}>
    {busy ? 'Sincronizando…' : 'Sincronizar'}
  </button>
  {#if report}
    <p class="msg" class:err={!report.ok}>
      {#if report.ok}
        OK · packs {report.contentVersion ?? '?'} · push {report.charactersSynced} · pull
        {report.charactersPulled} · grants {report.grantsPulled}
      {:else}
        {report.errors.join(' · ')}
      {/if}
    </p>
  {/if}
</div>

<style>
  .sync {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .badge {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: #d7efe0;
    color: #14532d;
  }
  .badge.off {
    background: #f3e0d0;
    color: #7c2d12;
  }
  button {
    border: 1px solid var(--line);
    background: var(--accent);
    color: white;
    border-radius: 6px;
    padding: 0.4rem 0.8rem;
    font: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .msg {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
  .msg.err {
    color: var(--danger);
  }
</style>
