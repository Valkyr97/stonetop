<script lang="ts">
  import type { CharacterState, MoveDef, Playbook } from '../../../content/types'
  import ChoiceCard from '../../../components/ChoiceCard.svelte'
  import CreationFields from '../../../components/CreationFields.svelte'
  import SoftMd from '../../../components/SoftMd.svelte'
  import WellVersedTopics from '../../../components/WellVersedTopics.svelte'
  import {
    freeChosenMoves,
    isStatBumpMove,
    moveById,
    pickOneMembers,
    startingMovesPlan,
    statBumpCap,
  } from '../../engine/moves'
  import { moveGateInfo } from '../../engine/moveTakes'
  import { parseTrackerLabel, playTrackerBoxes } from '../../engine/trackers'
  import { remainingBumpsForStat, type StatBumpPicks } from '../statBumps'
  import { STAT_KEYS } from '../../engine/stats'
  import { WELL_VERSED_MOVE_ID } from '../../engine/wellVersed'
  import { sortMovesForCatalog, type CatalogRow } from '../../moves/sortMovesForCatalog'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    readonly?: boolean
    onMarkTake: (moveId: string) => void
    onUnmarkTake: (moveId: string) => void
    onToggleTopic: (topicId: string) => void
    onFieldChange: (moveId: string, key: string, value: unknown) => void
    onStatBumpPick: (moveId: string, slotIndex: number, stat: string | null) => void
  }

  let {
    playbook,
    sheet,
    readonly = false,
    onMarkTake,
    onUnmarkTake,
    onToggleTopic,
    onFieldChange,
    onStatBumpPick,
  }: Props = $props()

  const plan = $derived(startingMovesPlan(playbook, sheet.identity.background_id))
  const effectGranted = $derived(
    (
      (sheet.setup.background_effect_grants as { moves?: string[] } | undefined)?.moves ?? []
    ).map(String),
  )
  const grantedIds = $derived([...new Set([...plan.granted, ...effectGranted])])
  const grantedSet = $derived(new Set(grantedIds))
  const pickOneIds = $derived(pickOneMembers(plan))
  const free = $derived(freeChosenMoves(sheet.moves.selected, plan, effectGranted))
  const selected = $derived(new Set(sheet.moves.selected))
  const atFreeLimit = $derived(plan.chooseCount > 0 && free.length >= plan.chooseCount)

  const catalogRows = $derived(sortMovesForCatalog(playbook.moves))

  /** Descendants nested under a catalog parent (relative depth), keyed by parent id. */
  const kidsByPickOne = $derived.by(() => {
    const map = new Map<string, CatalogRow[]>()
    for (const parentId of pickOneIds) {
      const idx = catalogRows.findIndex((r) => r.move.id === parentId)
      if (idx < 0) {
        map.set(parentId, [])
        continue
      }
      const base = catalogRows[idx]!.depth
      const out: CatalogRow[] = []
      for (let i = idx + 1; i < catalogRows.length; i++) {
        const row = catalogRows[i]!
        if (row.depth <= base) break
        out.push({ move: row.move, depth: row.depth - base })
      }
      map.set(parentId, out)
    }
    return map
  })

  const underPickOne = $derived.by(() => {
    const ids = new Set<string>()
    for (const kids of kidsByPickOne.values()) {
      for (const row of kids) ids.add(row.move.id)
    }
    return ids
  })

  /** Free / reference list — re-sorted so nesting stays correct after filtering. */
  const listRows = $derived(
    sortMovesForCatalog(
      playbook.moves.filter(
        (m) =>
          !grantedSet.has(m.id) && !pickOneIds.has(m.id) && !underPickOne.has(m.id),
      ),
    ),
  )

  function gateFor(move: MoveDef) {
    return moveGateInfo(sheet, playbook, move)
  }

  function selectPickOne(id: string) {
    if (readonly) return
    if (selected.has(id)) onUnmarkTake(id)
    else onMarkTake(id)
  }

  function toggleListMove(move: MoveDef) {
    if (readonly) return
    const on = selected.has(move.id)
    if (on) {
      onUnmarkTake(move.id)
      return
    }
    if (!canMarkNew(move)) return
    const gate = gateFor(move)
    if (gate.gated) return
    onMarkTake(move.id)
  }

  function takesOf(id: string): number {
    return sheet.moves.selected.filter((m) => m === id).length
  }

  function bumpBase(): Record<string, number> {
    const base: Record<string, number> = { STR: 0, DEX: 0, INT: 0, WIS: 0, CON: 0, CHA: 0 }
    Object.assign(base, (sheet.setup.stat_base as Record<string, number> | undefined) ?? {})
    return base
  }

  function showExtras(move: MoveDef): boolean {
    if (move.id === WELL_VERSED_MOVE_ID) return true
    if (isStatBumpMove(move)) return true
    return (move.creation_fields ?? []).some((f) => f.key !== 'stat' && f.key !== 'additional_topic')
  }

  function canMarkNew(move: MoveDef): boolean {
    if (selected.has(move.id)) return true
    if (plan.chooseCount <= 0) return false
    if (atFreeLimit) return false
    return true
  }

  function trackProps(move: MoveDef) {
    const useBoxes = playTrackerBoxes(move)
    if (useBoxes < 1) return {}
    const track = parseTrackerLabel(move.tracker?.label)
    return {
      useBoxes,
      useMarked: 0,
      useLabel: track.title,
      useMarkLabels: track.markLabels,
      useInteractive: false,
    }
  }
</script>

{#snippet moveExtras(move: MoveDef, takes: number, bumpCap: number | null)}
  <div class="free-extras">
    {#if move.id === WELL_VERSED_MOVE_ID}
      <WellVersedTopics {playbook} {sheet} disabled={readonly} onToggle={onToggleTopic} />
    {/if}
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
    {#if bumpCap !== null}
      {@const picks =
        (sheet.setup.stat_bump_picks as StatBumpPicks | undefined)?.[move.id] ?? []}
      {@const allPicks = (sheet.setup.stat_bump_picks as StatBumpPicks | undefined) ?? {}}
      {@const base = bumpBase()}
      <div class="stat-bump-picks">
        {#each Array.from({ length: Math.max(1, takes) }) as _, slot}
          <label class="bump-pick">
            Pick {slot + 1} raises
            <select
              disabled={readonly}
              value={picks[slot] ?? ''}
              onchange={(e) => onStatBumpPick(move.id, slot, e.currentTarget.value || null)}
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
  </div>
{/snippet}

<h2>Starting moves</h2>
{#if playbook.flavor}
  <div class="playbook-flavor lede"><SoftMd text={playbook.flavor} /></div>
{/if}

{#if grantedIds.length}
  <section class="move-block">
    <h3>You start with</h3>
    <div class="choices">
      {#each grantedIds as id (id)}
        {@const move = moveById(playbook, id)}
        {@const takes = takesOf(id)}
        {@const bumpCap = move ? statBumpCap(move) : null}
        <div class="list-row held">
          <ChoiceCard
            title={move?.name ?? id}
            selected={true}
            disabled={true}
            ruleText={move?.rule_text}
            {...(move ? trackProps(move) : {})}
          />
          {#if move && !readonly && showExtras(move)}
            {@render moveExtras(move, takes, bumpCap)}
          {/if}
        </div>
      {/each}
    </div>
  </section>
{/if}

{#each plan.pickOneGroups as group, i (i)}
  <section class="move-block">
    <h3>Choose one</h3>
    <div class="choices two-col">
      {#each group as id (id)}
        {@const move = moveById(playbook, id)}
        {@const kids = kidsByPickOne.get(id) ?? []}
        <div class="pick-stack">
          <ChoiceCard
            title={move?.name ?? id}
            selected={selected.has(id)}
            disabled={readonly}
            ruleText={move?.rule_text}
            {...(move ? trackProps(move) : {})}
            onclick={() => selectPickOne(id)}
          />
          {#each kids as { move: child, depth } (child.id)}
            {@const on = selected.has(child.id)}
            {@const gate = gateFor(child)}
            {@const takes = takesOf(child.id)}
            {@const bumpCap = statBumpCap(child)}
            <div
              class="list-row"
              class:nested={depth > 0}
              class:gated={gate.gated && !on}
              class:held={on}
              style={`--depth: ${depth}`}
            >
              <ChoiceCard
                title={child.name}
                selected={on}
                disabled={readonly || (!on && (gate.gated || !canMarkNew(child)))}
                meta={gate.gated && !on ? gate.reasons[0] : undefined}
                ruleText={child.rule_text}
                {...trackProps(child)}
                onclick={gate.gated && !on ? undefined : () => toggleListMove(child)}
              />
              {#if on && !readonly && showExtras(child)}
                {@render moveExtras(child, takes, bumpCap)}
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </section>
{/each}

{#if plan.chooseCount > 0}
  <section class="move-block">
    <h3>
      Choose {plan.chooseCount}
      <span class="count-muted">({free.length}/{plan.chooseCount})</span>
    </h3>
    <div class="choices">
      {#each listRows as { move, depth } (move.id)}
        {@const on = selected.has(move.id)}
        {@const gate = gateFor(move)}
        {@const takes = takesOf(move.id)}
        {@const bumpCap = statBumpCap(move)}
        {@const blocked = !on && (gate.gated || !canMarkNew(move))}
        <div
          class="list-row"
          class:nested={depth > 0}
          class:gated={blocked}
          class:held={on}
          style={`--depth: ${depth}`}
        >
          <ChoiceCard
            title={move.name}
            selected={on}
            disabled={readonly || blocked}
            meta={gate.gated && !on ? gate.reasons[0] : undefined}
            ruleText={move.rule_text}
            {...trackProps(move)}
            onclick={blocked ? undefined : () => toggleListMove(move)}
          />
          {#if on && !readonly && showExtras(move)}
            {@render moveExtras(move, takes, bumpCap)}
          {/if}
        </div>
      {/each}
    </div>
  </section>
{:else}
  <section class="move-block">
    <p class="hint">
      This playbook has no extra starting-move picks. You can continue once any fields
      on the moves above are filled in.
    </p>
  </section>
{/if}

<style>
  .move-block {
    margin-top: 1.15rem;
  }
  .move-block :global(h3) {
    margin: 0 0 0.55rem;
  }
  .pick-stack {
    display: grid;
    gap: 0.55rem;
    align-content: start;
  }
  .list-row {
    display: grid;
    gap: 0.45rem;
    margin-left: calc(var(--depth, 0) * 1.25rem);
  }
  .list-row.nested {
    padding-left: 0.65rem;
    border-left: 1px dotted var(--line);
  }
  .list-row.gated :global(.choice) {
    opacity: 0.55;
  }
  .list-row.gated.held :global(.choice) {
    opacity: 1;
  }
  .hint {
    margin: 0 0 0.55rem;
    font-size: 0.88rem;
    color: var(--ink-muted);
  }
  .free-extras {
    display: grid;
    gap: 0.45rem;
    padding-left: 0.35rem;
  }
  .stat-bump-picks {
    display: grid;
    gap: 0.45rem;
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
