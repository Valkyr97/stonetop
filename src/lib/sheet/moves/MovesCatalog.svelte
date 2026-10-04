<!--
  Shared moves catalog for creation, level-up, Edit, and Play.
  Take boxes = times chosen; uses = spendable play marks (Play) or max (Edit).
-->
<script lang="ts">
  import type { CharacterState, MoveDef, Playbook } from '../../content/types'
  import ChoiceCard from '../../components/ChoiceCard.svelte'
  import CreationFields from '../../components/CreationFields.svelte'
  import WellVersedTopics from '../../components/WellVersedTopics.svelte'
  import { moveRepeatCap } from '../sections'
  import {
    heldCounts,
    moveGateInfo,
    confirmGatedMark,
    confirmUnmarkTake,
    protectedTakeCount,
  } from '../engine/moveTakes'
  import { isStatBumpMove, statBumpCap } from '../engine/moves'
  import { parseTrackerLabel, playTrackerBoxes } from '../engine/trackers'
  import {
    WELL_VERSED_MOVE_ID,
    readMarkedTopics,
    topicLabel,
  } from '../engine/wellVersed'
  import { sortMovesForCatalog } from './sortMovesForCatalog'
  import {
    remainingBumpsForStat,
    type StatBumpPicks,
  } from '../wizard/statBumps'
  import { STAT_KEYS } from '../engine/stats'

  type CatalogMode = 'create' | 'levelup' | 'edit' | 'play'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    mode: CatalogMode
    readonly?: boolean
    markedOnly?: boolean
    grantSources?: Map<string, string>
    respectHidden?: boolean
    onMarkTake: (moveId: string) => void
    onUnmarkTake?: (moveId: string) => void
    onSpendUse?: (moveId: string, marked: number) => void
    onSetUseBoxes?: (moveId: string, boxes: number) => void
    onToggleTopic?: (topicId: string) => void
    onFieldChange?: (moveId: string, key: string, value: unknown) => void
    onStatBumpPick?: (moveId: string, slotIndex: number, stat: string | null) => void
  }

  let {
    playbook,
    sheet,
    mode,
    readonly = false,
    markedOnly = false,
    grantSources = new Map(),
    respectHidden = false,
    onMarkTake,
    onUnmarkTake,
    onSpendUse,
    onSetUseBoxes,
    onToggleTopic,
    onFieldChange,
    onStatBumpPick,
  }: Props = $props()

  const counts = $derived(heldCounts(sheet, playbook))
  const hidden = $derived(
    new Set(
      respectHidden && Array.isArray(sheet.setup.hidden_moves)
        ? (sheet.setup.hidden_moves as unknown[]).map(String)
        : [],
    ),
  )

  const rows = $derived.by(() => {
    const sorted = sortMovesForCatalog(playbook.moves)
    return sorted.filter(({ move }) => {
      if (hidden.has(move.id)) return false
      if (markedOnly && (counts.get(move.id) ?? 0) < 1) return false
      return true
    })
  })

  const effectiveLevel = $derived(
    mode === 'levelup' ? sheet.mechanics.level + 1 : sheet.mechanics.level,
  )

  const takesLocked = $derived(mode === 'play' || readonly)
  const canUnmark = $derived(mode === 'create' || mode === 'edit')
  const choicesEditable = $derived(
    !readonly && (mode === 'create' || mode === 'edit'),
  )
  const choicesReadOnly = $derived(mode === 'play' || mode === 'levelup')

  function gateFor(move: MoveDef) {
    return moveGateInfo(sheet, playbook, move, effectiveLevel)
  }

  function tryMark(move: MoveDef) {
    if (takesLocked) return
    const taken = counts.get(move.id) ?? 0
    const cap = moveRepeatCap(move)
    if (taken >= cap) return
    const gate = gateFor(move)
    if (gate.gated && !confirmGatedMark(move.name, gate.reasons)) return
    onMarkTake(move.id)
  }

  function tryUnmark(move: MoveDef) {
    if (!canUnmark || !onUnmarkTake || takesLocked) return
    const taken = counts.get(move.id) ?? 0
    const floor = protectedTakeCount(playbook, sheet, move.id)
    if (taken <= floor) return
    if (mode === 'edit' && !confirmUnmarkTake(move.name)) return
    onUnmarkTake(move.id)
  }

  function onTakeSlot(move: MoveDef, slotIndex: number) {
    if (takesLocked) return
    const taken = counts.get(move.id) ?? 0
    if (slotIndex < taken) tryUnmark(move)
    else tryMark(move)
  }

  function useBoxesFor(move: MoveDef): number {
    const tracker = sheet.mechanics.trackers[move.id]
    if (tracker) return tracker.boxes
    return playTrackerBoxes(move)
  }

  function useMarkedFor(move: MoveDef): number {
    return sheet.mechanics.trackers[move.id]?.marked ?? 0
  }

  function useTrackFor(move: MoveDef) {
    return parseTrackerLabel(move.tracker?.label)
  }

  function selectedTopicLabels(): string[] {
    return readMarkedTopics(sheet).map(topicLabel)
  }

  function fieldSummary(move: MoveDef): string[] {
    const values =
      ((sheet.setup.move_fields as Record<string, Record<string, unknown>> | undefined)?.[
        move.id
      ] ?? {}) as Record<string, unknown>
    const lines: string[] = []
    for (const f of move.creation_fields ?? []) {
      if (f.key === 'stat' || f.key === 'additional_topic') continue
      const v = values[f.key]
      if (v == null || v === '') continue
      lines.push(`${f.key}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
    }
    return lines
  }

  function bumpBase(): Record<string, number> {
    const base: Record<string, number> = { STR: 0, DEX: 0, INT: 0, WIS: 0, CON: 0, CHA: 0 }
    Object.assign(base, (sheet.setup.stat_base as Record<string, number> | undefined) ?? {})
    return base
  }
</script>

<div class="catalog">
  {#each rows as { move, depth } (move.id)}
    {@const takes = counts.get(move.id) ?? 0}
    {@const takeCap = moveRepeatCap(move)}
    {@const gate = gateFor(move)}
    {@const source = grantSources.get(move.id)}
    {@const useBoxes = useBoxesFor(move)}
    {@const useMarked = useMarkedFor(move)}
    {@const showUses = useBoxes >= 1 && !isStatBumpMove(move)}
    {@const useTrack = showUses ? useTrackFor(move) : { title: null, markLabels: [] as string[] }}
    {@const bumpCap = statBumpCap(move)}
    <div
      class="row"
      class:nested={depth > 0}
      class:gated={gate.gated && takes < 1}
      class:held={takes > 0}
      style={`--depth: ${depth}`}
    >
      <ChoiceCard
        title={move.name}
        selected={takes > 0}
        badge={source}
        meta={gate.gated && takes < takeCap ? gate.reasons[0] : undefined}
        ruleText={move.rule_text}
        boxes={takeCap}
        filled={takes}
        forceMarks={true}
        useBoxes={showUses ? useBoxes : 0}
        useMarked={useMarked}
        useLabel={useTrack.title}
        useMarkLabels={useTrack.markLabels}
        useInteractive={mode === 'play' && !readonly && !!onSpendUse}
        useMaxEditable={mode === 'edit' && !readonly && !!onSetUseBoxes}
        onUseMark={onSpendUse ? (n) => onSpendUse(move.id, n) : undefined}
        onUseMaxChange={onSetUseBoxes ? (n) => onSetUseBoxes(move.id, n) : undefined}
        onclick={
          takesLocked
            ? undefined
            : () => {
                if (takes > 0 && takeCap === 1 && canUnmark) tryUnmark(move)
                else if (takes < takeCap) tryMark(move)
              }
        }
        onSlotClick={takesLocked ? undefined : (i) => onTakeSlot(move, i)}
        fillSelected={false}
      />

      {#if takes > 0 && choicesEditable}
        {#if move.id === WELL_VERSED_MOVE_ID && onToggleTopic}
          <WellVersedTopics
            {playbook}
            {sheet}
            disabled={readonly}
            onToggle={onToggleTopic}
          />
        {/if}
        {#if onFieldChange}
          <CreationFields
            fields={move.creation_fields ?? []}
            {playbook}
            values={
              ((sheet.setup.move_fields as Record<string, Record<string, unknown>> | undefined)?.[
                move.id
              ] ?? {}) as Record<string, unknown>
            }
            disabled={readonly}
            skipKeys={[
              'stat',
              ...(move.id === WELL_VERSED_MOVE_ID ? ['additional_topic'] : []),
            ]}
            onFieldChange={(key, value) => onFieldChange(move.id, key, value)}
          />
        {/if}
        {#if bumpCap !== null && onStatBumpPick}
          {@const picks =
            (sheet.setup.stat_bump_picks as StatBumpPicks | undefined)?.[move.id] ?? []}
          {@const allPicks = (sheet.setup.stat_bump_picks as StatBumpPicks | undefined) ?? {}}
          {@const base = bumpBase()}
          <div class="stat-bump-picks">
            {#each Array.from({ length: takes }) as _, slot}
              <label class="bump-pick">
                Pick {slot + 1} raises
                <select
                  disabled={readonly}
                  value={picks[slot] ?? ''}
                  onchange={(e) =>
                    onStatBumpPick(move.id, slot, e.currentTarget.value || null)}
                >
                  <option value="">—</option>
                  {#each STAT_KEYS as stat}
                    {@const left = remainingBumpsForStat(
                      base,
                      allPicks,
                      playbook.moves,
                      move.id,
                      stat,
                      bumpCap,
                      slot,
                    )}
                    <option value={stat} disabled={left <= 0 && picks[slot] !== stat}>
                      {stat}{left <= 0 && picks[slot] !== stat ? ` (max +${bumpCap})` : ''}
                    </option>
                  {/each}
                </select>
              </label>
            {/each}
          </div>
        {/if}
      {:else if takes > 0 && choicesReadOnly}
        {@const topics =
          move.id === WELL_VERSED_MOVE_ID ? selectedTopicLabels() : []}
        {@const fields = fieldSummary(move)}
        {#if topics.length || fields.length}
          <ul class="summary">
            {#each topics as label}
              <li>{label}</li>
            {/each}
            {#each fields as line}
              <li>{line}</li>
            {/each}
          </ul>
        {/if}
      {/if}
    </div>
  {/each}
</div>

<style>
  .catalog {
    display: grid;
    gap: 0.45rem;
  }
  .row {
    margin-left: calc(var(--depth, 0) * 1.25rem);
  }
  .row.nested {
    padding-left: 0.65rem;
    border-left: 1px dotted var(--line);
  }
  .row.gated :global(.choice) {
    opacity: 0.55;
  }
  .row.gated.held :global(.choice) {
    opacity: 1;
  }
  .summary {
    list-style: none;
    margin: 0.4rem 0 0;
    padding: 0;
    font-size: 0.88rem;
    color: var(--ink-muted);
    display: grid;
    gap: 0.2rem;
  }
  .stat-bump-picks {
    display: grid;
    gap: 0.45rem;
    margin-top: 0.5rem;
  }
  .bump-pick {
    display: grid;
    gap: 0.25rem;
    font-size: 0.88rem;
  }
  .bump-pick select {
    font: inherit;
    padding: 0.35rem 0.5rem;
  }
</style>
