<script lang="ts">
  import { onMount } from 'svelte'
  import { push, replace } from 'svelte-spa-router'
  import AppShell from '../lib/components/AppShell.svelte'
  import CreationProgress from '../lib/components/CreationProgress.svelte'
  import FloatingStepNav from '../lib/components/FloatingStepNav.svelte'
  import { emptyCharacterState, type Playbook } from '../lib/content/types'
  import { getCreationPack } from '../lib/content/packLoader'
  import { saveCharacterDraft } from '../lib/db/idb'
  import {
    CREATION_STEP_COUNT,
    creationProgress,
  } from '../lib/sheet/wizard/steps'

  let playbooks = $state<Playbook[]>([])
  let packVersion = $state('0.1.1')
  let selected = $state('')
  let error = $state('')
  let busy = $state(false)

  onMount(async () => {
    try {
      const pack = await getCreationPack()
      playbooks = pack.content.playbooks
      packVersion = String(pack._meta?.version ?? packVersion)
      if (playbooks[0]) selected = playbooks[0].id
    } catch (e) {
      error = (e as Error).message
    }
  })

  async function onCreate() {
    const playbook = playbooks.find((p) => p.id === selected)
    if (!playbook) return
    busy = true
    error = ''
    try {
      const state = emptyCharacterState(playbook)
      const id = crypto.randomUUID()

      await saveCharacterDraft({
        id,
        playbookId: playbook.id,
        state: state as unknown as Record<string, unknown>,
        contentVersion: packVersion,
        dirty: true,
        updatedAt: new Date().toISOString(),
        claim: null,
      })
      replace(`/character/${id}`)
    } catch (e) {
      error = (e as Error).message
    } finally {
      busy = false
    }
  }
</script>

<AppShell>
  <section class="new-character">
    <CreationProgress
      label="Playbook"
      stepNumber={1}
      stepCount={CREATION_STEP_COUNT}
      progress={creationProgress(1)}
    />

    <header class="hero">
      <h1 class="brand-display">Choose a playbook</h1>
      <p class="lede">Your playbook is who you are in Stonetop — pick the one that calls to you.</p>
      {#if error}<p class="err">! {error}</p>{/if}
    </header>

    <ul class="grid">
      {#each playbooks as pb}
        <li>
          <button
            type="button"
            class="playbook"
            class:selected={selected === pb.id}
            aria-pressed={selected === pb.id}
            onclick={() => (selected = pb.id)}
          >
            <span class="name">{pb.name}</span>
            {#if pb.flavor}
              <span class="flavor">{pb.flavor}</span>
            {/if}
          </button>
        </li>
      {:else}
        <li class="empty">Loading playbooks…</li>
      {/each}
    </ul>
  </section>

  <FloatingStepNav
    prevLabel="Back to Home"
    nextLabel="Start creation"
    onPrev={() => push('/')}
    onNext={onCreate}
    nextDisabled={busy || !selected}
  />
</AppShell>

<style>
  .new-character {
    display: grid;
    gap: 1.5rem;
    /* Keep the last playbook cards clear of the floating arrows. */
    padding-bottom: 5.5rem;
  }
  .hero {
    display: grid;
    gap: 0.5rem;
  }
  .hero h1 {
    margin: 0;
    font-size: 2rem;
  }
  .lede {
    margin: 0;
    color: var(--ink-muted);
  }
  .grid {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
  }
  @media (max-width: 40rem) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .playbook {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    width: 100%;
    height: 100%;
    min-height: 11rem;
    text-align: left;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper-2);
    color: var(--ink);
    padding: 1.1rem 1.15rem;
    font: inherit;
    cursor: pointer;
  }
  .playbook:hover {
    border-color: var(--accent);
  }
  .playbook.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--paper-2));
  }
  .name {
    font-family: var(--font-display);
    font-size: 1.35rem;
    line-height: 1.15;
  }
  .flavor {
    font-size: 0.9rem;
    line-height: 1.45;
    color: var(--ink-muted);
  }
  .empty {
    grid-column: 1 / -1;
    color: var(--ink-muted);
  }
  .err {
    color: var(--danger);
  }
</style>
