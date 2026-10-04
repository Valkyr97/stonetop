<script lang="ts">
  import type { CharacterState, Playbook } from '../../../content/types'
  import type { PatchSheet } from '../../sheetPatch'
  import {
    advancementLog,
    addCustomTracker,
    bumpCustomTracker,
    canLevelUp,
    DEBILITY_KEYS,
    DEBILITY_LABELS,
    isStatDebilitated,
    readCustomTrackers,
    removeCustomTracker,
    setCustomTrackerMarks,
    STAT_KEYS,
    xpForNextLevel,
  } from '../../engine'
  import VitalControl from '../../../components/VitalControl.svelte'
  import XpTally from '../../../components/XpTally.svelte'
  import CreationFields from '../../../components/CreationFields.svelte'
  import ChoiceCard from '../../../components/ChoiceCard.svelte'
  import { renderRuleProse } from '../../../content/renderProse'
  import { possessionUseTrack } from '../../engine/possessionTracks'
  import Inventory from '../Inventory.svelte'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    mode?: 'play' | 'edit'
    readonly?: boolean
    patch: PatchSheet
    onOpenLevelUp: () => void
  }

  let { playbook, sheet, mode = 'play', readonly = false, patch, onOpenLevelUp }: Props = $props()

  const customTokens = $derived(readCustomTrackers(sheet))
  const xpCost = $derived(xpForNextLevel(sheet.mechanics.level))
  const readyToLevel = $derived(canLevelUp(sheet))
  const advancement = $derived(advancementLog(sheet, playbook))

  let newTokenLabel = $state('')
  let newTokenBoxes = $state(3)

  type SpecialItem = {
    id: string
    name: string
    rule_text?: string | null
    usesMax?: number
  }

  const specialPack = $derived(
    (playbook.special_possessions ?? {}) as {
      fixed?: SpecialItem[]
      options?: (SpecialItem & { state?: { uses?: { max?: number } } })[]
    },
  )

  const heldSpecials = $derived.by(() => {
    const selected = new Set(sheet.possessions.selected)
    const out: SpecialItem[] = []
    for (const item of specialPack.fixed ?? []) {
      out.push({
        id: item.id,
        name: item.name,
        rule_text: item.rule_text,
        usesMax: (item as { state?: { uses?: { max?: number } } }).state?.uses?.max,
      })
    }
    for (const item of specialPack.options ?? []) {
      if (!selected.has(item.id)) continue
      out.push({
        id: item.id,
        name: item.name,
        rule_text: item.rule_text,
        usesMax: item.state?.uses?.max,
      })
    }
    if (selected.has('custom') && sheet.possessions.custom) {
      out.push({ id: 'custom', name: sheet.possessions.custom, rule_text: null })
    }
    return out
  })

  const background = $derived(
    playbook.backgrounds.find((b) => b.id === sheet.identity.background_id) ?? null,
  )
  const backgroundFields = $derived(
    (sheet.setup.background_fields as Record<string, unknown> | undefined) ?? {},
  )
  const instinctDef = $derived(
    playbook.instincts.find((i) => i.id === sheet.identity.instinct_id) ?? null,
  )
  const instinctLabel = $derived.by(() => {
    if (sheet.identity.instinct_write_in?.trim()) return sheet.identity.instinct_write_in.trim()
    return instinctDef?.label ?? sheet.identity.instinct_id ?? '—'
  })
  const instinctBlurb = $derived(instinctDef?.description ?? null)

  const POSSESSION_USES_CAP = 10

  function setDebility(key: (typeof DEBILITY_KEYS)[number], value: boolean) {
    patch((d) => {
      d.mechanics.debilities = { ...d.mechanics.debilities, [key]: value }
    })
  }

  function setXpMarks(n: number) {
    patch((d) => {
      d.mechanics.xp = Math.max(0, n)
    })
  }

  function addToken() {
    if (readonly) return
    const label = newTokenLabel.trim() || 'Token'
    patch((d) => {
      d.mechanics.customTrackers = addCustomTracker(d, label, newTokenBoxes)
    })
    newTokenLabel = ''
    newTokenBoxes = 3
  }

  function setPossessionUses(id: string, marked: number) {
    patch((d) => {
      d.possessions.details = { ...(d.possessions.details ?? {}), [`${id}:uses`]: marked }
    })
  }

  function possessionUsesMarked(id: string): number {
    const v = (sheet.possessions.details as Record<string, unknown> | undefined)?.[`${id}:uses`]
    return typeof v === 'number' ? v : 0
  }

  function possessionUsesMax(id: string, packMax: number | undefined): number {
    const v = (sheet.possessions.details as Record<string, unknown> | undefined)?.[`${id}:usesMax`]
    if (typeof v === 'number' && Number.isFinite(v)) {
      return Math.min(POSSESSION_USES_CAP, Math.max(0, Math.floor(v)))
    }
    return Math.min(POSSESSION_USES_CAP, Math.max(0, packMax ?? 0))
  }

  function setPossessionUsesMax(id: string, max: number, packMax: number | undefined) {
    const next = Math.min(POSSESSION_USES_CAP, Math.max(0, Math.floor(max)))
    const catalog = Math.min(POSSESSION_USES_CAP, Math.max(0, packMax ?? 0))
    patch((d) => {
      const details = { ...(d.possessions.details ?? {}) } as Record<string, unknown>
      if (next === catalog) delete details[`${id}:usesMax`]
      else details[`${id}:usesMax`] = next
      const marked = details[`${id}:uses`]
      if (typeof marked === 'number') {
        if (next <= 0) delete details[`${id}:uses`]
        else details[`${id}:uses`] = Math.min(marked, next)
      }
      d.possessions.details = details
    })
  }

  function setBackgroundField(key: string, value: unknown) {
    patch((d) => {
      d.setup.background_fields = { ...((d.setup.background_fields as object) ?? {}), [key]: value }
    })
  }
</script>

<div class="sheet-top">
  <div class="vitals compact-vitals">
    <VitalControl
      compact
      label="HP"
      value={sheet.mechanics.hp_current}
      max={sheet.mechanics.max_hp}
      min={0}
      {readonly}
      onchange={(v) => patch((d) => { d.mechanics.hp_current = v })}
    />
    <VitalControl
      compact
      label="Armor"
      value={sheet.mechanics.armor}
      min={0}
      max={10}
      {readonly}
      onchange={(v) => patch((d) => { d.mechanics.armor = v })}
    />
    <div class="readout damage-readout">
      <span class="k">Damage</span>
      <span class="v">{sheet.mechanics.damage_die}</span>
    </div>
    <div class="readout damage-readout">
      <span class="k">Level</span>
      <span class="v">{sheet.mechanics.level}</span>
    </div>
  </div>

  <Inventory
    bandOnly
    data={sheet.inserts.inventory}
    {mode}
    {readonly}
    onchange={(next) => patch((d) => {
      d.inserts.inventory = next as unknown as Record<string, unknown>
    })}
  />

  <div class="xp-instinct">
    <div class="xp-bar">
      <XpTally xp={sheet.mechanics.xp} {readonly} onchange={setXpMarks} />
      <button
        type="button"
        class="action level-btn"
        disabled={readonly || !readyToLevel}
        onclick={onOpenLevelUp}
      >
        {readyToLevel ? `Level up → ${sheet.mechanics.level + 1}` : `Need ${xpCost} XP`}
      </button>
    </div>
    <aside class="instinct-card" aria-label="Instinct">
      <span class="k">Instinct</span>
      <strong class="instinct-name">{instinctLabel}</strong>
      {#if instinctBlurb}
        <p class="instinct-blurb">{instinctBlurb}</p>
      {/if}
    </aside>
  </div>
</div>

<h3>Stats</h3>
<div class="stat-pills">
  {#each STAT_KEYS as stat}
    {@const down = isStatDebilitated(sheet.mechanics.debilities, stat)}
    <div
      class="stat-pill"
      class:debilitated={down}
      title={down ? `${stat}: disadvantage` : undefined}
      aria-label={down ? `${stat} debilitated` : stat}
    >
      {#if down}<span class="debuff-mark" aria-hidden="true">!</span>{/if}
      <span class="k">{stat}</span>
      <span class="v">{sheet.mechanics.stats[stat] >= 0 ? '+' : ''}{sheet.mechanics.stats[stat] ?? 0}</span>
    </div>
  {/each}
</div>
<div class="debilities compact-deb">
  {#each DEBILITY_KEYS as key}
    <label class="debility" class:on={sheet.mechanics.debilities[key]}>
      <input
        type="checkbox"
        checked={sheet.mechanics.debilities[key]}
        disabled={readonly}
        onchange={(e) => setDebility(key, e.currentTarget.checked)}
      />
      {DEBILITY_LABELS[key]}
    </label>
  {/each}
</div>

{#if heldSpecials.length}
  <h3>Special possessions</h3>
  <div class="specials compact-specials">
    {#each heldSpecials as item}
      {@const catalog = possessionUseTrack(item)}
      {@const usesMax = possessionUsesMax(item.id, catalog.boxes)}
      {@const marked = Math.min(possessionUsesMarked(item.id), usesMax)}
      {@const tag = String((sheet.possessions.details as Record<string, unknown> | undefined)?.[`${item.id}:tag`] ?? '')}
      <ChoiceCard
        title={item.name}
        ruleText={catalog.prose}
        meta={tag ? `Tag: ${tag}` : undefined}
        useBoxes={usesMax}
        useMarked={marked}
        useLabel={catalog.title}
        useMarkLabels={catalog.markLabels}
        useInteractive={mode === 'play' && !readonly && usesMax > 0}
        useMaxEditable={mode === 'edit' && !readonly && usesMax > 0}
        onUseMark={(n) => setPossessionUses(item.id, n)}
        onUseMaxChange={(n) => setPossessionUsesMax(item.id, n, catalog.boxes)}
      />
    {/each}
  </div>
{/if}

<h3>Tokens</h3>
<div class="token-list">
  {#each customTokens as tracker, index}
    <div class="token-row">
      <div class="token-head">
        <span class="token-label">{tracker.label}</span>
        <div class="token-actions">
          <button
            type="button"
            class="tok-btn"
            disabled={readonly || tracker.marked <= 0}
            onclick={() => patch((d) => {
              d.mechanics.customTrackers = bumpCustomTracker(d, index, -1)
            })}
          >−</button>
          <button
            type="button"
            class="tok-btn"
            disabled={readonly || tracker.marked >= tracker.boxes}
            onclick={() => patch((d) => {
              d.mechanics.customTrackers = bumpCustomTracker(d, index, 1)
            })}
          >+</button>
          <button
            type="button"
            class="tok-btn danger"
            disabled={readonly}
            title="Remove token"
            onclick={() => patch((d) => {
              d.mechanics.customTrackers = removeCustomTracker(d, index)
            })}
          >×</button>
        </div>
      </div>
      <div class="xp-boxes" role="group" aria-label={tracker.label}>
        {#each Array(tracker.boxes) as _, i}
          <button
            type="button"
            class="xp-box"
            class:on={i < tracker.marked}
            disabled={readonly}
            aria-pressed={i < tracker.marked}
            onclick={() => patch((d) => {
              const next = tracker.marked === i + 1 ? i : i + 1
              d.mechanics.customTrackers = setCustomTrackerMarks(d, index, next)
            })}
          ></button>
        {/each}
      </div>
    </div>
  {/each}
</div>
{#if !readonly}
  <div class="token-add">
    <input type="text" placeholder="e.g. Readiness" bind:value={newTokenLabel} />
    <label class="boxes-pick">
      boxes
      <input type="number" min="1" max="12" bind:value={newTokenBoxes} />
    </label>
    <button type="button" class="action" onclick={addToken}>Add</button>
  </div>
{/if}

<h3>Background</h3>
{#if background}
  <details class="bg-fold">
    <summary>
      <span class="bg-title-row">
        <strong>{background.name}</strong>
        <span class="bg-chevron" aria-hidden="true"></span>
      </span>
      {#if background.rule_text}
        <span class="bg-preview">{background.rule_text.replace(/\s+/g, ' ').trim()}</span>
      {/if}
    </summary>
    {#if background.rule_text}
      <div class="move-prose">{@html renderRuleProse(background.rule_text)}</div>
    {/if}
    <CreationFields
      fields={background.creation_fields ?? []}
      {playbook}
      values={backgroundFields}
      disabled={readonly || !!sheet.creation_complete}
      onFieldChange={(key, value) => setBackgroundField(key, value)}
    />
  </details>
{:else}
  <p class="hint">No background selected.</p>
{/if}
{#if sheet.identity.pronouns || sheet.identity.origin_id}
  <p class="meta">
    {#if sheet.identity.pronouns}{sheet.identity.pronouns}{/if}
    {#if sheet.identity.pronouns && sheet.identity.origin_id} · {/if}
    {#if sheet.identity.origin_id}
      {playbook.origins.find((o) => o.id === sheet.identity.origin_id)?.label ?? sheet.identity.origin_id}
    {/if}
  </p>
{/if}

{#if advancement.length}
  <details class="fold-block adv-log">
    <summary>Advancement log ({advancement.length})</summary>
    <ul class="log">
      {#each advancement as entry}
        <li>
          Level {entry.level}: {entry.moveName}
          {#if entry.stat} (+1 {entry.stat}){/if}
          {#if entry.replacedName} — replaces {entry.replacedName}{/if}
        </li>
      {/each}
    </ul>
  </details>
{/if}

<style>
  h3 { margin: 1rem 0 0.4rem; font-size: 0.95rem; }
  .vitals { display: grid; gap: 0.75rem; margin-bottom: 0.85rem; }
  .compact-vitals { grid-template-columns: 1fr 1fr; gap: 0.45rem; margin-bottom: 0.55rem; }
  .damage-readout { justify-content: center; min-width: 0; align-self: stretch; padding: 0.45rem 0.55rem; }
  .sheet-top { display: grid; gap: 0.65rem; margin-bottom: 0.85rem; }
  .xp-instinct { display: grid; gap: 0.55rem; }
  .xp-bar {
    display: grid; gap: 0.45rem; padding: 0.55rem 0.65rem;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-2);
  }
  .xp-bar :global(.xp-wrap) { max-width: none; }
  .xp-bar .level-btn { margin-top: 0; width: 100%; }
  .instinct-card {
    display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-2); min-width: 0;
  }
  .instinct-card .k {
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-muted);
  }
  .instinct-name { font-size: 1rem; font-weight: 700; line-height: 1.25; }
  .instinct-blurb { margin: 0; font-size: 0.82rem; line-height: 1.4; color: var(--ink-muted); }
  @media (min-width: 560px) {
    .compact-vitals { grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: start; }
    .damage-readout { min-height: auto; }
    .xp-instinct { grid-template-columns: minmax(0, 1.35fr) minmax(9rem, 0.85fr); align-items: stretch; }
  }
  .readout {
    display: flex; flex-direction: column; align-items: center; padding: 0.5rem 0.75rem;
    border-radius: var(--radius); background: var(--paper-2); border: 1px solid var(--line); min-width: 4.5rem;
  }
  .readout .k { font-size: 0.72rem; color: var(--ink-muted); text-transform: uppercase; }
  .readout .v { font-size: 1.1rem; font-weight: 700; font-family: ui-monospace, monospace; }
  .stat-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.75rem 0; }
  .stat-pill {
    display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.7rem;
    border-radius: var(--radius); border: 1px solid var(--line); background: var(--paper-2);
    color: var(--ink); font-size: 0.9rem; font-family: ui-monospace, monospace;
  }
  .stat-pill .k { font-weight: 700; color: var(--accent); }
  .stat-pill.debilitated {
    border-color: var(--ink); border-style: dashed;
    background: repeating-linear-gradient(-45deg, color-mix(in srgb, var(--danger) 14%, var(--paper-2)), color-mix(in srgb, var(--danger) 14%, var(--paper-2)) 4px, var(--paper-2) 4px, var(--paper-2) 8px);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger) 40%, transparent);
  }
  .stat-pill.debilitated .k { color: var(--ink); text-decoration: underline; text-decoration-style: wavy; text-underline-offset: 2px; }
  .debuff-mark { font-size: 0.75rem; font-weight: 800; color: var(--danger); line-height: 1; }
  .debilities { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; }
  .compact-deb { gap: 0.35rem 0.85rem; margin: 0.35rem 0 0.75rem; }
  .debility { display: flex; align-items: center; gap: 0.3rem; font-size: var(--text-sm); min-height: var(--btn-min); }
  .compact-deb .debility { font-size: 0.78rem; min-height: 1.6rem; color: var(--ink-muted); }
  .debility.on { color: var(--ink); font-weight: 700; }
  .specials { display: grid; gap: 0.75rem; }
  .compact-specials { gap: 0.4rem; }
  .compact-specials :global(.choice) { padding: 0.5rem 0.65rem; }
  .bg-fold { border: 1px solid var(--line); border-radius: var(--radius); padding: 0.45rem 0.65rem; background: var(--paper-2); margin-bottom: 0.5rem; }
  .bg-fold summary { cursor: pointer; list-style: none; display: grid; gap: 0.25rem; }
  .bg-fold summary::-webkit-details-marker { display: none; }
  .bg-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 0.65rem; }
  .bg-chevron::before { content: '▸'; color: var(--ink-muted); font-size: 0.85rem; }
  .bg-fold[open] .bg-chevron::before { content: '▾'; }
  .bg-preview {
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
    font-size: 0.82rem; line-height: 1.4; color: var(--ink-muted); font-weight: 400;
  }
  .bg-fold[open] .bg-preview { display: none; }
  .fold-block { margin: 0.85rem 0; border: 1px solid var(--line); border-radius: var(--radius); padding: 0.45rem 0.65rem; background: var(--paper-2); }
  .fold-block summary { cursor: pointer; font-weight: 600; font-size: 0.9rem; list-style: none; }
  .fold-block summary::-webkit-details-marker { display: none; }
  .adv-log { margin-top: 1.25rem; }
  .xp-boxes { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .xp-box {
    width: 1.25rem; height: 1.25rem; border: 1.5px solid var(--line); border-radius: 3px;
    background: var(--paper); padding: 0; cursor: pointer;
  }
  .xp-box.on { background: var(--accent); border-color: var(--accent); }
  .xp-box:disabled { cursor: default; opacity: 0.7; }
  .token-list { display: grid; gap: 0.85rem; margin-bottom: 0.75rem; }
  .token-row { display: grid; gap: 0.4rem; }
  .token-head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .token-label { font-weight: 600; }
  .token-actions { display: flex; gap: 0.25rem; }
  .tok-btn {
    width: 1.75rem; height: 1.75rem; border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--paper-2); color: var(--ink); font: inherit; cursor: pointer;
  }
  .tok-btn.danger { color: var(--danger); }
  .token-add { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; margin-bottom: 1rem; }
  .token-add input[type='text'] {
    flex: 1; min-width: 8rem; border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--paper); color: var(--ink); padding: 0.45rem 0.6rem; font: inherit;
  }
  .boxes-pick { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: var(--ink-muted); }
  .boxes-pick input {
    width: 3.2rem; border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--paper); color: var(--ink); padding: 0.35rem; font: inherit;
  }
  .level-btn { margin: 0.65rem 0 1rem; width: 100%; max-width: 22rem; }
  .level-btn:disabled { opacity: 0.45; }
  .action {
    margin-top: 0.55rem;
  }
  .log { padding-left: 1.1rem; font-size: var(--text-sm); }
</style>
