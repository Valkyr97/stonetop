<script lang="ts">
  import type { CharacterState, Playbook } from '../../../content/types'
  import { renderRuleProse } from '../../../content/renderProse'
  import { fetchBasicMoves, scrubBasicMoveText, type BasicMove } from '../../../content/basicMoves'
  import MovesCatalog from '../../moves/MovesCatalog.svelte'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    mode: 'play' | 'edit'
    readonly?: boolean
    grantSources: Map<string, string>
    onMarkTake: (moveId: string) => void
    onUnmarkTake?: (moveId: string) => void
    onSpendUse?: (moveId: string, marked: number) => void
    onSetUseBoxes?: (moveId: string, boxes: number) => void
    onToggleTopic?: (topicId: string) => void
    onFieldChange?: (moveId: string, key: string, value: unknown) => void
  }

  let {
    playbook,
    sheet,
    mode,
    readonly = false,
    grantSources,
    onMarkTake,
    onUnmarkTake,
    onSpendUse,
    onSetUseBoxes,
    onToggleTopic,
    onFieldChange,
  }: Props = $props()

  const catalogMode = $derived(mode === 'edit' ? 'edit' : 'play')

  let basicMoves = $state<BasicMove[]>([])
  let basicMovesOpen = $state(false)

  $effect(() => {
    let alive = true
    fetchBasicMoves().then((moves) => {
      if (alive) basicMoves = moves
    })
    return () => {
      alive = false
    }
  })
</script>

<h2>Moves</h2>
<p class="lede">
  {#if mode === 'edit'}
    Edit mode: mark or unmark takes freely (with confirmation). Define use maxima here.
  {:else}
    Your marked moves. Take boxes are locked; spend uses during play. Switch to Edit to change takes or choices.
  {/if}
</p>
<MovesCatalog
  {playbook}
  {sheet}
  mode={catalogMode}
  {readonly}
  markedOnly={mode === 'play'}
  {grantSources}
  respectHidden={mode === 'play'}
  {onMarkTake}
  {onUnmarkTake}
  {onSpendUse}
  {onSetUseBoxes}
  {onToggleTopic}
  {onFieldChange}
/>

{#if basicMoves.length}
  <details class="basic-moves" bind:open={basicMovesOpen}>
    <summary>Basic moves</summary>
    <p class="lede">Moves every character can make.</p>
    <div class="move-list">
      {#each basicMoves as move}
        <article class="move-entry">
          <header class="move-head">
            <h3>{move.name}</h3>
          </header>
          <div class="move-prose">{@html renderRuleProse(scrubBasicMoveText(move.text))}</div>
        </article>
      {/each}
    </div>
  </details>
{/if}

<style>
  h2 { margin: 0 0 0.5rem; font-family: var(--font-display); font-weight: 400; }
  .move-list { display: grid; gap: 0.45rem; }
  .move-entry { padding: 0.05rem 0 0.4rem; border-bottom: 1px solid var(--line); }
  .move-entry:last-child { border-bottom: 0; padding-bottom: 0; }
  .move-head { display: flex; gap: 0.45rem; align-items: baseline; margin-bottom: 0.25rem; }
  .move-head h3 {
    margin: 0; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.01em; flex: 1; min-width: 0;
  }
  .basic-moves { margin-top: 1.25rem; border-top: 1px solid var(--line); padding-top: 0.65rem; }
  .basic-moves summary {
    cursor: pointer; font-size: 0.95rem; font-weight: 700; list-style: none;
    display: flex; align-items: center; gap: 0.35rem; min-height: var(--btn-min);
  }
  .basic-moves summary::-webkit-details-marker { display: none; }
  .basic-moves summary::before { content: '▸'; color: var(--accent); font-size: 0.85rem; }
  .basic-moves[open] summary::before { content: '▾'; }
  .basic-moves .lede { margin: 0.25rem 0 0.55rem; }
  .move-prose { margin-bottom: 0.25rem; }
  .move-prose :global(p) { margin: 0 0 0.35rem; }
  .move-prose :global(p:last-child) { margin-bottom: 0; }
</style>
