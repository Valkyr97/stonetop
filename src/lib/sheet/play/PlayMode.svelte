<script lang="ts">
  import type { ArcanaCard, CharacterState, InsertDef, Playbook } from '../../content/types'
  import type { LocalArcanaState, LocalGrant } from '../../db/idb'
  import type { PatchSheet } from '../sheetPatch'
  import {
    attachInsert,
    canLevelUp,
    detachInsert,
    isStatBumpMove,
    moveById,
    STAT_KEYS,
    xpForNextLevel,
    syncTrackers,
    grantSourceMap,
    heldCounts,
    markTakeEdit,
    markTakeLevelUp,
    unmarkTakeEdit,
    moveTopicQuota,
    playerMarkedTopics,
    togglePlayerTopic,
    WELL_VERSED_MOVE_ID,
    setTrackerMarks,
    type StatKey,
  } from '../engine'
  import { visibleManualInsertIds } from '../../grant/visibility'
  import ChoiceCard from '../../components/ChoiceCard.svelte'
  import ArcanaPanel from '../../components/ArcanaPanel.svelte'
  import Inventory from './Inventory.svelte'
  import SheetTab from './tabs/SheetTab.svelte'
  import MovesTab from './tabs/MovesTab.svelte'
  import RelationsTab from './tabs/RelationsTab.svelte'
  import InsertPane from './tabs/InsertPane.svelte'
  import LevelUpModal from './LevelUpModal.svelte'

  interface Props {
    playbook: Playbook
    inserts: InsertDef[]
    sheet: CharacterState
    mode?: 'play' | 'edit'
    readonly?: boolean
    grants?: LocalGrant[]
    arcanaCards?: ArcanaCard[]
    arcanaStates?: LocalArcanaState[]
    onchange: (sheet: CharacterState) => void
    onArcanaStateChange?: (row: LocalArcanaState) => void
    onRequestEdit?: () => void
  }

  let {
    playbook,
    inserts,
    sheet,
    mode = 'play',
    readonly = false,
    grants = [],
    arcanaCards = [],
    arcanaStates = [],
    onchange,
    onArcanaStateChange,
    onRequestEdit,
  }: Props = $props()

  const moveGrantSources = $derived(grantSourceMap(playbook, sheet))

  type TabId = 'sheet' | 'moves' | 'inventory' | 'relations' | 'arcana' | 'add' | string

  const hasArcana = $derived(grants.some((g) => g.content_type.startsWith('arcana')))
  const attachedInsertIds = $derived(Object.keys(sheet.inserts).filter((id) => id !== 'inventory'))
  const attachableManualIds = $derived(
    visibleManualInsertIds(grants, inserts).filter((id) => !(id in sheet.inserts)),
  )

  const tabs = $derived([
    { id: 'sheet' as TabId, label: 'Sheet' },
    { id: 'moves' as TabId, label: 'Moves' },
    { id: 'inventory' as TabId, label: 'Inventory' },
    { id: 'relations' as TabId, label: 'Relations' },
    ...attachedInsertIds.map((id) => ({
      id,
      label: inserts.find((i) => i.id === id)?.name ?? id,
    })),
    ...(hasArcana ? [{ id: 'arcana' as TabId, label: 'Arcana' }] : []),
    ...(attachableManualIds.length ? [{ id: 'add' as TabId, label: '+' }] : []),
  ])

  let active = $state<TabId>('sheet')
  let tabsEl = $state<HTMLElement | null>(null)
  let tabsHeight = $state(44)
  $effect(() => {
    if (!tabs.some((t) => t.id === active)) active = 'sheet'
  })
  $effect(() => {
    const el = tabsEl
    if (!el || typeof ResizeObserver === 'undefined') return
    const apply = () => {
      tabsHeight = Math.max(40, Math.ceil(el.getBoundingClientRect().height))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  })

  const patch: PatchSheet = (mutator) => {
    if (readonly) return
    let next: CharacterState
    try {
      next = $state.snapshot(sheet) as CharacterState
    } catch {
      next = JSON.parse(JSON.stringify(sheet)) as CharacterState
    }
    mutator(next)
    onchange(next)
  }

  function markTracker(moveId: string, marked: number) {
    if (mode !== 'play' || readonly) return
    patch((d) => {
      d.mechanics.trackers = syncTrackers(d, playbook)
      d.mechanics.trackers = setTrackerMarks(d, moveId, marked)
    })
  }

  function setUseBoxes(moveId: string, boxes: number) {
    if (mode !== 'edit' || readonly) return
    patch((d) => {
      d.mechanics.trackers = syncTrackers(d, playbook)
      const prev = d.mechanics.trackers[moveId]
      if (!prev) {
        const move = moveById(playbook, moveId)
        if (!move) return
        d.mechanics.trackers[moveId] = { label: move.name, boxes, marked: 0 }
        return
      }
      d.mechanics.trackers[moveId] = {
        ...prev,
        boxes,
        marked: Math.min(prev.marked, boxes),
      }
    })
  }

  function setMoveField(moveId: string, key: string, value: unknown) {
    if (mode !== 'edit' || readonly) return
    patch((d) => {
      const all = {
        ...((d.setup.move_fields as Record<string, Record<string, unknown>> | undefined) ?? {}),
      }
      all[moveId] = { ...(all[moveId] ?? {}), [key]: value }
      d.setup.move_fields = all
    })
  }

  function toggleWellVersedTopic(topicId: string) {
    if (readonly || mode !== 'edit') return
    patch((d) => {
      togglePlayerTopic(d, playbook, topicId)
    })
  }

  function markEditTake(moveId: string) {
    if (readonly || mode !== 'edit') return
    const move = moveById(playbook, moveId)
    if (move && isStatBumpMove(move)) {
      const stat = window.prompt(`Raise which stat with ${move.name}? (STR/DEX/INT/WIS/CON/CHA)`)
      if (!stat || !STAT_KEYS.includes(stat as StatKey)) return
      const result = markTakeEdit(sheet, playbook, moveId, stat as StatKey)
      if (!result.ok) {
        window.alert(result.error)
        return
      }
      onchange(result.state)
      return
    }
    const result = markTakeEdit(sheet, playbook, moveId)
    if (!result.ok) {
      window.alert(result.error)
      return
    }
    onchange(result.state)
  }

  function unmarkEditTake(moveId: string) {
    if (readonly || mode !== 'edit') return
    const result = unmarkTakeEdit(sheet, playbook, moveId)
    if (!result.ok) {
      window.alert(result.error)
      return
    }
    onchange(result.state)
  }

  function moveNeedsFollowUp(next: CharacterState, moveId: string): boolean {
    if (moveId === WELL_VERSED_MOVE_ID) {
      const takes = heldCounts(next, playbook).get(WELL_VERSED_MOVE_ID) ?? 0
      const quota = moveTopicQuota(takes)
      return playerMarkedTopics(playbook, next).length < quota
    }
    const move = moveById(playbook, moveId)
    if (!move || isStatBumpMove(move)) return false
    const fields = (move.creation_fields ?? []).filter(
      (f) => f.key !== 'stat' && f.key !== 'additional_topic',
    )
    if (!fields.length) return false
    const values =
      ((next.setup.move_fields as Record<string, Record<string, unknown>> | undefined)?.[moveId] ??
        {}) as Record<string, unknown>
    return fields.some((f) => {
      const v = values[f.key]
      return v == null || v === '' || (Array.isArray(v) && v.length === 0)
    })
  }

  const xpCost = $derived(xpForNextLevel(sheet.mechanics.level))
  const readyToLevel = $derived(canLevelUp(sheet))

  let levelUpOpen = $state(false)
  let pendingMoveId = $state('')
  let pendingStat = $state('')
  let levelUpError = $state('')

  function openLevelUp() {
    if (!readyToLevel || readonly) return
    pendingMoveId = ''
    pendingStat = ''
    levelUpError = ''
    levelUpOpen = true
  }

  function closeLevelUp() {
    levelUpOpen = false
    pendingMoveId = ''
    pendingStat = ''
    levelUpError = ''
  }

  function snapshotSheet(): CharacterState {
    try {
      return $state.snapshot(sheet) as CharacterState
    } catch {
      return JSON.parse(JSON.stringify(sheet)) as CharacterState
    }
  }

  function finishLevelUp(moveId: string, stat?: StatKey) {
    const result = markTakeLevelUp(snapshotSheet(), playbook, moveId, stat)
    if (!result.ok) {
      levelUpError = result.error
      return
    }
    onchange(result.state)
    closeLevelUp()
    if (moveNeedsFollowUp(result.state, moveId)) {
      active = 'moves'
      onRequestEdit?.()
    }
  }

  function onLevelUpMark(moveId: string) {
    if (readonly || !readyToLevel) return
    const move = moveById(playbook, moveId)
    if (!move) return
    if (isStatBumpMove(move)) {
      pendingMoveId = moveId
      pendingStat = ''
      levelUpError = 'Choose which stat to raise.'
      return
    }
    finishLevelUp(moveId)
  }

  function confirmLevelUpStat() {
    if (!pendingMoveId || !pendingStat) {
      levelUpError = 'Choose which stat to raise.'
      return
    }
    finishLevelUp(pendingMoveId, pendingStat as StatKey)
  }

  function attach(id: string) {
    patch((d) => {
      d.inserts = attachInsert(d, id)
    })
    active = id
  }

  function detach(id: string) {
    patch((d) => {
      d.inserts = detachInsert(d, id)
    })
    active = 'sheet'
  }
</script>

<div class="play" style="--play-tabs-h: {tabsHeight}px">
  <header class="play-header">
    <div class="titles">
      <p class="eyebrow">{playbook.name} · Level {sheet.mechanics.level}</p>
      <h1>{sheet.identity.character_name || 'Unnamed'}</h1>
    </div>
    <span class="badge">In play</span>
  </header>

  <nav class="tabs" aria-label="Play sections" bind:this={tabsEl}>
    {#each tabs as t}
      <button type="button" class="tab" class:active={active === t.id} onclick={() => (active = t.id)}>
        {t.label}
      </button>
    {/each}
  </nav>

  <main class="pane">
    {#if active === 'sheet'}
      <SheetTab {playbook} {sheet} {readonly} {patch} onOpenLevelUp={openLevelUp} />
    {:else if active === 'moves'}
      <MovesTab
        {playbook}
        {sheet}
        {mode}
        {readonly}
        grantSources={moveGrantSources}
        onMarkTake={mode === 'edit' ? markEditTake : () => {}}
        onUnmarkTake={mode === 'edit' ? unmarkEditTake : undefined}
        onSpendUse={mode === 'play' ? markTracker : undefined}
        onSetUseBoxes={mode === 'edit' ? setUseBoxes : undefined}
        onToggleTopic={mode === 'edit' ? toggleWellVersedTopic : undefined}
        onFieldChange={mode === 'edit' ? setMoveField : undefined}
      />
    {:else if active === 'inventory'}
      <Inventory
        data={sheet.inserts.inventory}
        {readonly}
        onchange={(next) => patch((d) => {
          d.inserts.inventory = next as unknown as Record<string, unknown>
        })}
      />
    {:else if active === 'relations'}
      <RelationsTab {playbook} {sheet} {readonly} {patch} />
    {:else if active === 'arcana'}
      <ArcanaPanel
        {grants}
        cards={arcanaCards}
        states={arcanaStates}
        {readonly}
        onStateChange={onArcanaStateChange}
      />
    {:else if active === 'add'}
      <h2>Add an insert</h2>
      <p class="lede">Your GM has hung these — attach one when it's time to use it.</p>
      <div class="choices">
        {#each attachableManualIds as id}
          {@const insert = inserts.find((i) => i.id === id)}
          {#if insert}
            <ChoiceCard title={insert.name} ruleText={insert.note ?? null} onclick={() => attach(id)} />
          {/if}
        {/each}
      </div>
    {:else}
      {@const insert = inserts.find((i) => i.id === active)}
      {#if insert}
        <InsertPane
          {insert}
          insertId={active}
          {sheet}
          {readonly}
          {patch}
          onDetach={detach}
        />
      {/if}
    {/if}
  </main>

  {#if levelUpOpen}
    <LevelUpModal
      {playbook}
      {sheet}
      {readonly}
      grantSources={moveGrantSources}
      {xpCost}
      {pendingMoveId}
      {pendingStat}
      {levelUpError}
      onClose={closeLevelUp}
      onMarkTake={onLevelUpMark}
      onPendingStat={(stat) => (pendingStat = stat)}
      onConfirmStat={confirmLevelUpStat}
    />
  {/if}
</div>

<style>
  .play {
    display: flex;
    flex-direction: column;
    gap: 0;
    max-width: 48rem;
    margin: 0 auto;
    min-height: 70vh;
  }
  .play-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding-bottom: 0.85rem;
    border-bottom: 2px solid var(--accent);
    margin-bottom: 0;
  }
  .eyebrow {
    margin: 0 0 0.2rem;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.45rem;
    line-height: 1.15;
    font-weight: 400;
  }
  .badge {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.25rem 0.55rem;
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--accent) 12%, var(--paper-2));
    color: var(--accent);
    white-space: nowrap;
  }
  .tabs {
    position: sticky;
    top: 0;
    z-index: 8;
    display: flex;
    flex-wrap: nowrap;
    gap: 0.15rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    border-bottom: 1px solid var(--line);
    margin-bottom: 1.25rem;
    background: var(--paper);
    margin-left: -0.25rem;
    margin-right: -0.25rem;
    padding-left: 0.25rem;
    padding-right: 0.25rem;
    box-shadow: 0 1px 0 var(--line);
  }
  .tabs::-webkit-scrollbar {
    display: none;
    height: 0;
  }
  .tab {
    flex: 0 0 auto;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    border-radius: 0;
    padding: 0.4rem 0.65rem;
    margin-bottom: -1px;
    font: inherit;
    font-size: var(--text-sm);
    white-space: nowrap;
    cursor: pointer;
    color: var(--ink-muted);
    min-height: var(--btn-min);
  }
  .tab:hover { color: var(--ink); }
  .tab.active {
    border-bottom-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
    background: transparent;
  }
  .pane { flex: 1; padding-top: 0.25rem; }
  .pane h2 {
    margin: 0 0 0.5rem;
    font-family: var(--font-display);
    font-weight: 400;
    color: var(--ink);
  }
  .choices { display: grid; gap: 0.45rem; }
  @media (max-width: 480px) {
    h1 { font-size: 1.25rem; }
  }
</style>
