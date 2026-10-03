<script lang="ts">
  import type { Background, CharacterState, InsertDef, Playbook } from '../../content/types'
  import { evaluateSectionStatus, replaceBackgroundMoves, startingMoveIds } from '../sections'
  import {
    WIZARD_STEPS,
    CREATION_STEP_COUNT,
    creationProgress,
    creationStepNumber,
    readyToFinish,
    stepValid,
    firstIncompleteStep,
    type WizardStepId,
  } from './steps'
  import { applyStatBumps, type StatBumpPicks } from './statBumps'
  import CreationProgress from '../../components/CreationProgress.svelte'
  import FloatingStepNav from '../../components/FloatingStepNav.svelte'
  import ChoicesRail from './ChoicesRail.svelte'
  import { applyBackgroundSelectionEffects } from './backgroundEffects'
  import { togglePlayerTopic } from '../engine/wellVersed'
  import type { PatchSheet } from '../sheetPatch'
  import './wizard-steps.css'
  import BackgroundStep from './steps/BackgroundStep.svelte'
  import InstinctStep from './steps/InstinctStep.svelte'
  import AppearanceStep from './steps/AppearanceStep.svelte'
  import OriginStep from './steps/OriginStep.svelte'
  import StatsStep from './steps/StatsStep.svelte'
  import MovesStep from './steps/MovesStep.svelte'
  import PossessionsStep from './steps/PossessionsStep.svelte'
  import DetailsStep from './steps/DetailsStep.svelte'
  import IntroductionsStep from './steps/IntroductionsStep.svelte'
  import ReviewStep from './steps/ReviewStep.svelte'

  interface PossessionItem {
    id: string
    name: string
    rule_text?: string | null
    state?: Record<string, unknown>
  }

  interface Props {
    playbook: Playbook
    inserts: InsertDef[]
    sheet: CharacterState
    readonly?: boolean
    onchange: (sheet: CharacterState) => void
    onFinish?: () => void
  }

  let { playbook, inserts, sheet, readonly = false, onchange, onFinish }: Props = $props()

  let step = $state<WizardStepId>(firstIncompleteStep(playbook, sheet))
  const stepIndex = $derived(WIZARD_STEPS.findIndex((s) => s.id === step))

  const patch: PatchSheet = (mutator) => {
    if (readonly) return
    let next: CharacterState
    try {
      next = $state.snapshot(sheet) as CharacterState
    } catch {
      next = JSON.parse(JSON.stringify(sheet)) as CharacterState
    }
    mutator(next)
    next.section_status = evaluateSectionStatus(playbook, next)
    onchange(next)
  }

  function statAssignments(d: CharacterState): StatAssignments {
    return (d.setup.stat_base as StatAssignments | undefined) ?? {}
  }

  function statBase(d: CharacterState): Record<string, number> {
    const base: Record<string, number> = { STR: 0, DEX: 0, INT: 0, WIS: 0, CON: 0, CHA: 0 }
    Object.assign(base, statAssignments(d))
    return base
  }

  function recomputeStats(d: CharacterState) {
    const picks = (d.setup.stat_bump_picks as StatBumpPicks | undefined) ?? {}
    d.mechanics.stats = applyStatBumps(statBase(d), picks, playbook.moves)
  }

  function toggleStatValue(stat: StatKey, value: number) {
    if (readonly) return
    patch((d) => {
      const next: StatAssignments = { ...statAssignments(d) }
      if (stat in next && next[stat] === value) delete next[stat]
      else next[stat] = value
      d.setup.stat_base = next
      recomputeStats(d)
    })
  }

  function goto(delta: number) {
    const next = WIZARD_STEPS[stepIndex + delta]
    if (!next) return
    if (delta > 0 && !stepValid(step, playbook, sheet)) return
    step = next.id
  }

  function jumpTo(stepId: WizardStepId) {
    if (WIZARD_STEPS.some((s) => s.id === stepId)) step = stepId
  }

  const stepNumber = $derived(creationStepNumber(stepIndex))
  const progressFrac = $derived(creationProgress(stepNumber))
  const canGoNext = $derived(
    step === 'review' ? readyToFinish(playbook, sheet) : stepValid(step, playbook, sheet),
  )

  $effect(() => {
    if (readonly || step !== 'moves') return
    const normalized = startingMoveIds(
      playbook,
      sheet.identity.background_id,
      sheet.moves.selected,
    )
    const same =
      normalized.length === sheet.moves.selected.length &&
      normalized.every((id, i) => id === sheet.moves.selected[i])
    if (same) return
    patch((d) => {
      d.moves.selected = normalized
    })
  })

  function onNext() {
    if (step === 'review') finishCreation()
    else goto(1)
  }

  function selectBackground(bg: Background, fieldPatch?: { key: string; value: unknown }) {
    if (readonly) return
    patch((d) => {
      const switching = d.identity.background_id !== bg.id
      const fromId = d.identity.background_id
      d.identity.background_id = bg.id
      d.moves.selected = switching
        ? replaceBackgroundMoves(playbook, fromId, bg.id, d.moves.selected)
        : startingMoveIds(playbook, bg.id, d.moves.selected)
      const prev = !switching
        ? ((d.setup.background_fields as Record<string, unknown> | undefined) ?? {})
        : {}
      const next: Record<string, unknown> = {}
      for (const f of bg.creation_fields ?? []) {
        if (f.key in prev) next[f.key] = prev[f.key]
        else if (f.type === 'counter' || f.type === 'uses' || f.type === 'number') {
          next[f.key] = f.initial ?? 0
        } else if (f.type === 'multi_choice') next[f.key] = []
        else if (f.type === 'text') next[f.key] = ''
      }
      if (fieldPatch) next[fieldPatch.key] = fieldPatch.value
      d.setup = { ...d.setup, background_id: bg.id, background_fields: next }
      applyBackgroundSelectionEffects(d, playbook)
    })
  }

  function setBackgroundField(bg: Background, key: string, value: unknown) {
    selectBackground(bg, { key, value })
  }

  function selectInstinct(id: string) {
    if (readonly) return
    patch((d) => {
      d.identity.instinct_id = id
      if (id !== 'custom') d.identity.instinct_write_in = ''
    })
  }

  const takeCounts = $derived(heldCounts(sheet, playbook))

  function setMoveField(moveId: string, key: string, value: unknown) {
    patch((d) => {
      const all = {
        ...((d.setup.move_fields as Record<string, Record<string, unknown>> | undefined) ?? {}),
      }
      all[moveId] = { ...(all[moveId] ?? {}), [key]: value }
      d.setup.move_fields = all
    })
  }

  function toggleWellVersedTopic(topicId: string) {
    if (readonly) return
    patch((d) => {
      togglePlayerTopic(d, playbook, topicId)
    })
  }

  function markCreationTake(moveId: string) {
    if (readonly) return
    const current = takeCounts.get(moveId) ?? 0
    const result = setCreationTakes(sheet, playbook, moveId, current + 1)
    if (!result.ok) return
    const nextCount = heldCounts(result.state, playbook).get(moveId) ?? 0
    if (nextCount <= current) return
    const next = result.state
    next.section_status = evaluateSectionStatus(playbook, next)
    const picks = (next.setup.stat_bump_picks as StatBumpPicks | undefined) ?? {}
    next.mechanics.stats = applyStatBumps(
      { STR: 0, DEX: 0, INT: 0, WIS: 0, CON: 0, CHA: 0, ...((next.setup.stat_base as object) ?? {}) },
      picks,
      playbook.moves,
    )
    onchange(next)
  }

  function unmarkCreationTake(moveId: string) {
    if (readonly) return
    const current = takeCounts.get(moveId) ?? 0
    const result = setCreationTakes(sheet, playbook, moveId, current - 1)
    if (!result.ok) return
    const next = result.state
    next.section_status = evaluateSectionStatus(playbook, next)
    const picks = (next.setup.stat_bump_picks as StatBumpPicks | undefined) ?? {}
    next.mechanics.stats = applyStatBumps(
      { STR: 0, DEX: 0, INT: 0, WIS: 0, CON: 0, CHA: 0, ...((next.setup.stat_base as object) ?? {}) },
      picks,
      playbook.moves,
    )
    onchange(next)
  }

  function setStatBumpPick(moveId: string, slotIndex: number, stat: string | null) {
    patch((d) => {
      const picks = { ...((d.setup.stat_bump_picks as StatBumpPicks | undefined) ?? {}) }
      const slots = [...(picks[moveId] ?? [])]
      slots[slotIndex] = stat
      picks[moveId] = slots
      d.setup.stat_bump_picks = picks
      recomputeStats(d)
    })
  }

  const possessions = $derived(
    (playbook.special_possessions as {
      fixed?: PossessionItem[]
      choose?: number
      options?: PossessionItem[]
      sacred_pouch_setup?: Record<string, unknown>
    }) ?? {},
  )

  function togglePossession(id: string) {
    if (readonly) return
    const max = possessions.choose ?? 0
    patch((d) => {
      const set = new Set(d.possessions.selected)
      if (set.has(id)) set.delete(id)
      else {
        if (max > 0 && set.size >= max) return
        set.add(id)
      }
      d.possessions.selected = [...set]
    })
  }

  function setPossessionWriteIn(value: string) {
    if (readonly) return
    const max = possessions.choose ?? 0
    patch((d) => {
      const selected = new Set(d.possessions.selected)
      const has = selected.has('custom')
      if (value.trim()) {
        if (!has && max > 0 && selected.size >= max) return
        selected.add('custom')
        d.possessions.custom = value
      } else {
        selected.delete('custom')
        d.possessions.custom = ''
      }
      d.possessions.selected = [...selected]
    })
  }

  function setIntroAnswer(n: number, value: string) {
    patch((d) => {
      const answers = {
        ...((d.setup.introductions as Record<string, string> | undefined) ?? {}),
        [String(n)]: value,
      }
      d.setup.introductions = answers
      if (n === 2) d.session_zero_notes.contribution_to_stonetop = value
    })
  }

  function finishCreation() {
    patch((d) => {
      d.inserts = attachAutoInserts(d, playbook, inserts)
      d.mechanics.trackers = syncTrackers(d, playbook)
      d.creation_complete = true
    })
    onFinish?.()
  }
</script>

<div class="wizard">
  <header class="wiz-header">
    <CreationProgress
      label={WIZARD_STEPS[stepIndex]?.label ?? 'Creating'}
      stepNumber={stepNumber}
      stepCount={CREATION_STEP_COUNT}
      progress={progressFrac}
    />
    <p class="eyebrow">Creating · {playbook.name}</p>
    <h1>{sheet.identity.character_name || 'New character'}</h1>
  </header>

  <div class="layout">
    <div class="main-col">
      <ChoicesRail {playbook} characterState={sheet} onJump={jumpTo} placement="inline" />

      <main class="step">
        {#if step === 'background'}
          <BackgroundStep {playbook} {sheet} {readonly} onSelect={selectBackground} onFieldChange={setBackgroundField} />
        {:else if step === 'instinct'}
          <InstinctStep {playbook} {sheet} {readonly} {patch} onSelect={selectInstinct} />
        {:else if step === 'appearance'}
          <AppearanceStep {playbook} {sheet} {readonly} {patch} />
        {:else if step === 'origin'}
          <OriginStep {playbook} {sheet} {readonly} {patch} />
        {:else if step === 'stats'}
          <StatsStep {playbook} {sheet} {readonly} onToggle={toggleStatValue} />
        {:else if step === 'moves'}
          <MovesStep
            {playbook}
            {sheet}
            {readonly}
            onMarkTake={markCreationTake}
            onUnmarkTake={unmarkCreationTake}
            onToggleTopic={toggleWellVersedTopic}
            onFieldChange={setMoveField}
            onStatBumpPick={setStatBumpPick}
          />
        {:else if step === 'possessions'}
          <PossessionsStep
            {playbook}
            {sheet}
            {readonly}
            {patch}
            onToggle={togglePossession}
            onWriteIn={setPossessionWriteIn}
          />
        {:else if step === 'details'}
          <DetailsStep {playbook} {sheet} {readonly} {patch} />
        {:else if step === 'introductions'}
          <IntroductionsStep {playbook} {sheet} {readonly} onAnswer={setIntroAnswer} />
        {:else if step === 'review'}
          <ReviewStep {playbook} {sheet} onJump={jumpTo} />
        {/if}
      </main>
    </div>

    <ChoicesRail {playbook} characterState={sheet} onJump={jumpTo} placement="aside" />
  </div>

  <FloatingStepNav
    prevLabel="Previous step"
    nextLabel={step === 'review' ? 'Finish creation' : 'Next step'}
    prevDisabled={stepIndex <= 0}
    nextDisabled={readonly || !canGoNext}
    onPrev={() => goto(-1)}
    onNext={onNext}
  />
</div>

<style>
  .wizard {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 70vh;
    padding-bottom: 5.5rem;
  }
  .wiz-header {
    display: grid;
    gap: 0.45rem;
  }
  .eyebrow {
    margin: 0.55rem 0 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
  }
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.45rem;
    line-height: 1.2;
    font-weight: 400;
  }
  .layout {
    display: grid;
    gap: 2rem;
  }
  .main-col {
    min-width: 0;
  }
  @media (min-width: 960px) {
    .layout {
      grid-template-columns: 1fr 16rem;
      align-items: start;
    }
  }
</style>
