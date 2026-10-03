<!--
  Book-style Well Versed topic checklist. Background-granted topics appear
  marked and locked; remaining quota can be toggled by the player.
-->
<script lang="ts">
  import type { CharacterState, Playbook } from '../content/types'
  import {
    WELL_VERSED_TOPICS,
    lockedTopicsFromBackground,
    moveTopicQuota,
    playerMarkedTopics,
    readMarkedTopics,
    wellVersedTakes,
  } from '../sheet/engine/wellVersed'
  import StatusCue from './StatusCue.svelte'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    disabled?: boolean
    onToggle: (topicId: string) => void
  }

  let { playbook, sheet, disabled = false, onToggle }: Props = $props()

  const locked = $derived(new Set(lockedTopicsFromBackground(playbook, sheet)))
  const marked = $derived(new Set(readMarkedTopics(sheet)))
  const takes = $derived(wellVersedTakes(playbook, sheet))
  const quota = $derived(moveTopicQuota(takes))
  const playerCount = $derived(playerMarkedTopics(playbook, sheet).length)
  const atQuota = $derived(playerCount >= quota)
  const complete = $derived(playerCount === quota && quota > 0)
</script>

<fieldset class="topics" disabled={disabled || quota <= 0}>
  <legend>
    Mark topics
    <span class="count" class:ok={complete} class:warn={quota > 0 && !complete}>
      {#if complete}
        <StatusCue kind="ok" />
      {:else if quota > 0}
        <StatusCue kind="warn" label="Topic marks incomplete" />
      {/if}
      ({playerCount}/{quota} from this move)
    </span>
  </legend>
  {#if locked.size}
    <p class="hint">
      Filled boxes from your background stay marked. Mark {quota}
      more from Well Versed{takes > 1 ? ` (${takes} takes)` : ''}.
    </p>
  {:else}
    <p class="hint">
      Mark {quota} topic{quota === 1 ? '' : 's'}
      {takes > 1 ? ` (${takes} takes of Well Versed)` : ''}.
    </p>
  {/if}

  <ul class="list">
    {#each WELL_VERSED_TOPICS as topic}
      {@const isLocked = locked.has(topic.id)}
      {@const isOn = marked.has(topic.id)}
      <li>
        <button
          type="button"
          class="row"
          class:on={isOn}
          class:locked={isLocked}
          disabled={disabled || isLocked || (!isOn && atQuota)}
          aria-pressed={isOn}
          title={isLocked ? 'Marked by your background' : undefined}
          onclick={() => onToggle(topic.id)}
        >
          <span class="box" class:filled={isOn} aria-hidden="true"></span>
          <span class="label">{topic.label}</span>
          {#if isLocked}
            <span class="tag">background</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</fieldset>

<style>
  .topics {
    margin: 0.75rem 0 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
    font-size: 0.88rem;
    font-weight: 600;
  }
  .count {
    margin-left: 0.35rem;
    font-weight: 400;
    color: var(--ink-muted);
  }
  .count.ok {
    color: var(--accent);
  }
  .count.warn {
    color: var(--danger, #8c2f22);
  }
  .hint {
    margin: 0.35rem 0 0;
    font-size: 0.82rem;
    color: var(--ink-muted);
  }
  .list {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    width: 100%;
    text-align: left;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--paper-2);
    color: var(--ink);
    padding: 0.5rem 0.7rem;
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .row.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--paper-2));
  }
  .row.locked {
    cursor: default;
  }
  .row:disabled:not(.locked) {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .box {
    width: 1.05rem;
    height: 1.05rem;
    border: 1.5px solid var(--ink-muted);
    border-radius: 3px;
    flex-shrink: 0;
    background: var(--paper-2);
  }
  .box.filled {
    border-color: var(--accent);
    background: var(--accent);
    box-shadow: inset 0 0 0 2px var(--paper-2);
  }
  .label {
    flex: 1;
    min-width: 0;
  }
  .tag {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
  }
</style>
