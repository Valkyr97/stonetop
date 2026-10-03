<script lang="ts">
  import type { CharacterState, Origin, Playbook } from '../../../content/types'
  import { PRONOUN_OPTIONS } from '../../sections'
  import type { PatchSheet } from '../../sheetPatch'
  import Field from '../../../components/Field.svelte'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    readonly?: boolean
    patch: PatchSheet
  }

  let { playbook, sheet, readonly = false, patch }: Props = $props()

  let showPronouns = $state(!!sheet.identity.pronouns)
  let pronounCustom = $state(
    !!sheet.identity.pronouns && !PRONOUN_OPTIONS.some((o) => o.id === sheet.identity.pronouns),
  )

  function selectedNameTokens(name: string, tokens: string[]): string[] {
    const allowed = new Set(tokens)
    return name
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0 && allowed.has(part))
  }

  function pickSuggestedName(label: string) {
    if (readonly) return
    patch((d) => {
      d.identity.name_source = 'suggested'
      d.identity.character_name = label
    })
  }

  function toggleGeneratedNameToken(origin: Origin, token: string) {
    if (readonly) return
    const gen = origin.name_generation
    if (!gen) return
    patch((d) => {
      const picks = selectedNameTokens(d.identity.character_name, gen.tokens)
      const at = picks.indexOf(token)
      let next: string[]
      if (at >= 0) {
        next = picks.filter((_, i) => i !== at)
      } else if (picks.length >= gen.max_tokens) {
        return
      } else {
        next = [...picks, token]
      }
      d.identity.name_source = 'suggested'
      d.identity.character_name = next.join(' ')
    })
  }
</script>

<h2>Origin &amp; name</h2>
<p class="lede">
  {playbook.origins_prompt ?? 'Where are you from? Then take a suggested name or write your own.'}
</p>
<div class="choices two-col">
  {#each playbook.origins as origin}
    <button
      type="button"
      class="origin-card"
      class:on={sheet.identity.origin_id === origin.id}
      disabled={readonly}
      aria-pressed={sheet.identity.origin_id === origin.id}
      onclick={() => patch((d) => { d.identity.origin_id = origin.id })}
    >
      <span class="origin-name">{origin.label}</span>
      {#if origin.note}
        <span class="origin-note">{origin.note}</span>
      {/if}
    </button>
  {/each}
</div>

<div class="name-block">
  <Field
    label="Name"
    value={sheet.identity.character_name}
    disabled={readonly}
    onchange={(v) => patch((d) => { d.identity.character_name = String(v) })}
  />
  <label class="pronoun-toggle">
    <input
      type="checkbox"
      checked={showPronouns}
      disabled={readonly}
      onchange={(e) => {
        showPronouns = e.currentTarget.checked
        if (!showPronouns) patch((d) => { d.identity.pronouns = '' })
      }}
    />
    I'd like to specify pronouns (optional)
  </label>
  {#if showPronouns}
    <Field
      label="Pronouns"
      type="single_choice_with_custom"
      options={PRONOUN_OPTIONS}
      value={pronounCustom ? '__custom__' : sheet.identity.pronouns}
      disabled={readonly}
      onchange={(v) => {
        if (v === '__custom__') pronounCustom = true
        else {
          pronounCustom = false
          patch((d) => { d.identity.pronouns = String(v) })
        }
      }}
    />
    {#if pronounCustom}
      <Field
        label="Pronouns (custom)"
        value={sheet.identity.pronouns}
        disabled={readonly}
        onchange={(v) => patch((d) => { d.identity.pronouns = String(v) })}
      />
    {/if}
  {/if}

  {#if sheet.identity.origin_id}
    {@const origin = playbook.origins.find((o) => o.id === sheet.identity.origin_id)}
    {@const gen = origin?.name_generation}
    {@const picked = gen ? selectedNameTokens(sheet.identity.character_name, gen.tokens) : []}
    {#if gen?.tokens?.length}
      <div class="name-examples">
        <p class="nested-label">Name tokens</p>
        <div class="name-picks">
          {#each gen.tokens as label}
            {@const order = picked.indexOf(label) + 1}
            {@const on = order > 0}
            {@const full = !on && picked.length >= gen.max_tokens}
            <button
              type="button"
              class="name-pick"
              class:on
              disabled={readonly || full}
              aria-pressed={on}
              aria-label={on ? `${label}, part ${order} of name` : `Add ${label} to name`}
              onclick={() => toggleGeneratedNameToken(origin!, label)}
            >
              {#if on}<span class="ord" aria-hidden="true">{order}</span>{/if}
              {label}
            </button>
          {/each}
        </div>
        <p class="hint">
          Tap tokens in order to build a name ({gen.min_tokens}–{gen.max_tokens} parts).
          The number shows which part each is. Tap again to remove.
        </p>
      </div>
    {:else if origin?.name_options?.length}
      <div class="name-examples">
        <p class="nested-label">Example names</p>
        <div class="name-picks">
          {#each origin.name_options as opt}
            <button
              type="button"
              class="name-pick"
              class:on={sheet.identity.character_name === opt.label}
              disabled={readonly}
              onclick={() => pickSuggestedName(opt.label)}
            >
              {opt.label}
            </button>
          {/each}
        </div>
        <p class="hint">You can also type your own name above; these are just suggestions.</p>
      </div>
    {/if}
  {/if}
</div>
