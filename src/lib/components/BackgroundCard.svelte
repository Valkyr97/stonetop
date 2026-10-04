<script lang="ts">
  import type { Background, Playbook } from '../content/types'
  import { renderRuleProse } from '../content/renderProse'
  import CreationFields from './CreationFields.svelte'

  interface Props {
    background: Background
    playbook: Playbook
    selected?: boolean
    disabled?: boolean
    /** Answers keyed by creation_field.key */
    fieldValues?: Record<string, unknown>
    onSelect?: () => void
    onFieldChange?: (key: string, value: unknown) => void
  }

  let {
    background,
    playbook,
    selected = false,
    disabled = false,
    fieldValues = {},
    onSelect,
    onFieldChange,
  }: Props = $props()

  const omens = $derived(Number(fieldValues.omens ?? 0))
  const hasFields = $derived((background.creation_fields?.length ?? 0) > 0)
</script>

<article
  class="bg"
  class:selected
  class:clickable={!disabled}
  role="button"
  tabindex={disabled ? -1 : 0}
  aria-pressed={selected}
  aria-disabled={disabled}
  onclick={() => {
    if (!disabled) onSelect?.()
  }}
  onkeydown={(e) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.()
    }
  }}
>
  <div class="pick">
    <span class="mark" aria-hidden="true"></span>
    <span class="title">{background.name}</span>
    {#if background.id === 'destined' || background.creation_fields?.some((f) => f.key === 'omens')}
      <span class="omens" aria-label="Omens">
        {#each [0, 1, 2] as i}
          <span class="omen" class:filled={omens > i}></span>
        {/each}
      </span>
    {/if}
  </div>

  {#if background.rule_text}
    <div class="prose">{@html renderRuleProse(background.rule_text)}</div>
  {:else}
    <p class="missing">No rule text in the pack for this background.</p>
  {/if}

  {#if hasFields}
    <div
      class="fields"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <CreationFields
        fields={background.creation_fields ?? []}
        {playbook}
        values={fieldValues}
        {disabled}
        onFieldChange={(key, value) => {
          if (!selected) onSelect?.()
          onFieldChange?.(key, value)
        }}
      />
      {#if !selected}
        <p class="hint">Checking an option selects this background.</p>
      {/if}
    </div>
  {/if}
</article>

<style>
  .bg {
    display: grid;
    gap: 0.65rem;
    padding: 0.9rem 1rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--paper-2);
  }
  .bg.clickable {
    cursor: pointer;
  }
  .bg.clickable:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .bg.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
    background: var(--selected-bg);
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    width: 100%;
    text-align: left;
  }
  .mark {
    width: 1.05rem;
    height: 1.05rem;
    border: 1.5px solid var(--ink-muted);
    border-radius: 3px;
    flex-shrink: 0;
    background: var(--paper-2);
  }
  .bg.selected .mark {
    border-color: var(--accent);
    background: var(--accent);
    box-shadow: inset 0 0 0 2px var(--paper-2);
  }
  .title {
    font-weight: 700;
    font-size: 1.02rem;
    letter-spacing: 0.01em;
  }
  .omens {
    margin-left: auto;
    display: inline-flex;
    gap: 0.25rem;
  }
  .omen {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    border: 1.5px solid var(--ink-muted);
  }
  .omen.filled {
    background: var(--accent);
    border-color: var(--accent);
  }
  .prose {
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--ink);
  }
  .prose :global(p) {
    margin: 0 0 0.5rem;
  }
  .prose :global(p:last-child) {
    margin-bottom: 0;
  }
  .prose :global(p.bullet) {
    margin: 0.15rem 0 0.15rem 0.15rem;
  }
  .prose :global(em) {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-weight: 400;
  }
  .prose :global(strong) {
    font-weight: 700;
  }
  .missing {
    margin: 0;
    color: var(--danger, #b91c1c);
    font-size: 0.85rem;
  }
  .fields {
    display: grid;
    gap: 0.35rem;
  }
  .fields :global(.creation-fields) {
    border-top: 0;
    padding-top: 0;
  }
  .hint {
    margin: 0.35rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
</style>
