<script lang="ts">
  import type { ArcanaCard, Background, InsertDef, MoveDef, Playbook } from '../content/types'
  import type { CharacterState } from '../content/types'
  import {
    CREATION_FLOW,
    PLAY_FLOW,
    PRONOUN_OPTIONS,
    SECTION_LABELS,
    availableLevel1Moves,
    evaluateSectionStatus,
    isCreationReady,
    replaceBackgroundMoves,
    startingMoveIds,
    moveRepeatCap,
    movePrintedBoxes,
    type SectionId,
  } from '../sheet/sections'
  import Field from './Field.svelte'
  import ChoiceCard from './ChoiceCard.svelte'
  import BackgroundCard from './BackgroundCard.svelte'
  import ArcanaPanel from './ArcanaPanel.svelte'
  import type { LocalArcanaState, LocalGrant } from '../db/idb'
  import { renderRuleProse } from '../content/renderProse'
  import { applyBackgroundSelectionEffects } from '../sheet/wizard/backgroundEffects'

  interface PossessionItem {
    id: string
    name: string
    rule_text?: string | null
    state?: Record<string, unknown>
    grants?: { type: string; id: string }[]
  }

  interface Props {
    playbook: Playbook
    inserts: InsertDef[]
    sheet: CharacterState
    readonly?: boolean
    grants?: LocalGrant[]
    arcanaCards?: ArcanaCard[]
    arcanaStates?: LocalArcanaState[]
    onchange: (sheet: CharacterState) => void
    onArcanaStateChange?: (row: LocalArcanaState) => void
  }

  let {
    playbook,
    inserts,
    sheet,
    readonly = false,
    grants = [],
    arcanaCards = [],
    arcanaStates = [],
    onchange,
    onArcanaStateChange,
  }: Props = $props()

  const hasArcana = $derived(grants.some((g) => g.content_type.startsWith('arcana')))
  const creating = $derived(!sheet.creation_complete)
  const flow = $derived(
    (creating ? CREATION_FLOW : PLAY_FLOW).filter((id) => id !== 'arcana' || hasArcana),
  )

  let active = $state<SectionId>('identity')
  let lastFlowKey = ''

  $effect(() => {
    const key = `${creating}:${flow.join(',')}`
    if (key !== lastFlowKey) {
      lastFlowKey = key
      if (!flow.includes(active)) active = flow[0]
    }
  })

  const status = $derived(evaluateSectionStatus(playbook, sheet))
  const readyToFinish = $derived(isCreationReady(playbook, sheet))
  const level1Moves = $derived(availableLevel1Moves(playbook))
  const possessions = $derived(
    (playbook.special_possessions as {
      fixed?: PossessionItem[]
      choose?: number
      options?: PossessionItem[]
      sacred_pouch_setup?: Record<string, unknown>
    }) ?? {},
  )

  let showPronouns = $state(!!sheet.identity.pronouns)
  let pronounCustom = $state(
    !!sheet.identity.pronouns && !PRONOUN_OPTIONS.some((o) => o.id === sheet.identity.pronouns),
  )

  function patch(mutator: (draft: CharacterState) => void) {
    if (readonly) return
    // sheet may be a Svelte 5 $state proxy; structuredClone throws on proxies.
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

  function assignStats(array: number[], order: string[]) {
    patch((d) => {
      for (const k of Object.keys(d.mechanics.stats)) d.mechanics.stats[k] = 0
      order.forEach((stat, i) => {
        d.mechanics.stats[stat] = array[i] ?? 0
      })
    })
  }

  function finishCreation() {
    patch((d) => {
      d.creation_complete = true
    })
    active = 'overview'
  }

  function goto(delta: number) {
    const next = flow[flow.indexOf(active) + delta]
    if (next) active = next
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
      const prev =
        !switching
          ? ((d.setup.background_fields as Record<string, unknown> | undefined) ?? {})
          : {}
      const next: Record<string, unknown> = {}
      for (const f of bg.creation_fields ?? []) {
        if (f.key in prev) next[f.key] = prev[f.key]
        else if (f.type === 'counter') next[f.key] = f.initial ?? 0
        else if (f.type === 'multi_choice') next[f.key] = []
      }
      if (fieldPatch) next[fieldPatch.key] = fieldPatch.value
      d.setup = { ...d.setup, background_id: bg.id, background_fields: next }
      applyBackgroundSelectionEffects(d, playbook)
    })
  }

  function setBackgroundField(bg: Background, key: string, value: unknown) {
    selectBackground(bg, { key, value })
  }

  const backgroundFieldValues = $derived(
    ((sheet.setup.background_fields as Record<string, unknown> | undefined) ?? {}),
  )

  function selectInstinct(id: string) {
    if (readonly) return
    patch((d) => {
      d.identity.instinct_id = id
    })
  }

  function toggleMove(move: MoveDef, fixed: boolean, bgGranted: boolean, slotIndex?: number) {
    if (readonly || fixed || bgGranted) return
    patch((d) => {
      const cap = moveRepeatCap(move)
      const current = d.moves.selected.filter((id) => id === move.id).length
      const others = d.moves.selected.filter((id) => id !== move.id)
      let nextCount = current
      if (cap > 1 && typeof slotIndex === 'number') {
        nextCount = slotIndex < current ? slotIndex : Math.min(cap, current + 1)
      } else if (current > 0) {
        nextCount = 0
      } else {
        nextCount = 1
      }
      d.moves.selected = startingMoveIds(playbook, d.identity.background_id, [
        ...others,
        ...Array.from({ length: nextCount }, () => move.id),
      ])
      const fixedSet = new Set([
        ...playbook.starting_move_rules.fixed ?? [],
        ...((playbook.backgrounds.find((b) => b.id === d.identity.background_id)?.grants ?? [])
          .filter((g) => g.type === 'move')
          .map((g) => g.id)),
      ])
      const extras = d.moves.selected.filter((id) => !fixedSet.has(id))
      const limit = playbook.starting_move_rules.free_choices
      if (extras.length > limit) {
        d.moves.selected = [...fixedSet, ...extras.slice(0, limit)]
      }
    })
  }

  function togglePossession(id: string) {
    if (readonly) return
    const max = possessions.choose ?? 0
    patch((d) => {
      const set = new Set(d.possessions.selected)
      if (set.has(id)) set.delete(id)
      else {
        if (max > 0 && set.size >= max) {
          const first = [...set][0]
          if (first) set.delete(first)
        }
        set.add(id)
      }
      d.possessions.selected = [...set]
    })
  }

  function nestedChoiceOptions(item: PossessionItem): string[] {
    const choice = item.state?.choice as { options?: string[] } | undefined
    return choice?.options ?? []
  }

  function nestedSelected(item: PossessionItem): string {
    const details = (sheet.possessions.details ?? {}) as Record<string, unknown>
    return String(details[item.id] ?? '')
  }

  function setNestedChoice(itemId: string, value: string) {
    patch((d) => {
      d.possessions.details = { ...(d.possessions.details ?? {}), [itemId]: value }
    })
  }

  const statOrder = ['STR', 'DEX', 'INT', 'WIS', 'CON', 'CHA']
  let customStatOrder = $state('STR,DEX,INT,WIS,CON,CHA')

  const relevantInserts = $derived.by(() => {
    const ids = new Set<string>(['inventory'])
    const bg = playbook.backgrounds.find((b) => b.id === sheet.identity.background_id)
    for (const g of bg?.grants ?? []) if (g.type === 'insert') ids.add(g.id)
    for (const g of playbook.grants ?? []) if (g.type === 'insert') ids.add(g.id)
    for (const m of sheet.moves.selected) {
      if (m === 'animal-companion') ids.add('animal-companion')
      if (m === 'crew') ids.add('crew')
    }
    return inserts.filter((i) => ids.has(i.id))
  })

  const SECTION_COLORS: Record<SectionId, string> = {
    overview: '#a1682f',
    identity: '#2563eb',
    appearance: '#7c3aed',
    stats: '#15803d',
    moves: '#c2410c',
    possessions: '#0f766e',
    setup: '#be185d',
    introductions: '#4338ca',
    inserts: '#78350f',
    arcana: '#6d28d9',
  }

  const selectedMoves = $derived(
    sheet.moves.selected.map((id) => playbook.moves.find((m) => m.id === id)).filter(Boolean),
  )

  const pageIndex = $derived(flow.indexOf(active) + 1)
</script>

<div
  class="sheet"
  class:mode-creation={creating}
  class:mode-play={!creating}
  style={`--section-color:${SECTION_COLORS[active]}`}
>
  <header class="sheet-header">
    <div class="brand-line">
      <div class="titles">
        <p class="mode-label">{creating ? 'Creación de personaje' : 'Ficha en juego'}</p>
        <h1>{playbook.name}</h1>
        <p class="sub">{sheet.identity.character_name || 'Sin nombre'}</p>
      </div>
      {#if creating}
        <span class="mode creating">Creación · {pageIndex}/{flow.length}</span>
      {:else}
        <span class="mode playing">En juego</span>
      {/if}
    </div>

    <nav class="pills" aria-label="Secciones de la ficha">
      {#each flow as sid}
        <button
          type="button"
          class="pill"
          class:active={active === sid}
          style={`--c:${SECTION_COLORS[sid]}`}
          onclick={() => (active = sid)}
        >
          {SECTION_LABELS[sid]}
          {#if creating && status[sid]}
            <em data-s={status[sid]}></em>
          {/if}
        </button>
      {/each}
    </nav>
  </header>

  <main class="page" data-view={active}>
    {#if active === 'overview'}
      <h2>Resumen</h2>
      <div class="overview-grid">
        <div class="stat-block"><span class="k">HP</span><span class="v">{sheet.mechanics.hp_current}/{sheet.mechanics.max_hp}</span></div>
        <div class="stat-block"><span class="k">Armor</span><span class="v">{sheet.mechanics.armor}</span></div>
        <div class="stat-block"><span class="k">Damage</span><span class="v">{sheet.mechanics.damage_die}</span></div>
        <div class="stat-block"><span class="k">Nivel</span><span class="v">{sheet.mechanics.level}</span></div>
        <div class="stat-block"><span class="k">XP</span><span class="v">{sheet.mechanics.xp}</span></div>
      </div>
      <div class="overview-stats">
        {#each statOrder as stat}
          <div class="stat-pill">
            <span class="k">{stat}</span>
            <span class="v">{sheet.mechanics.stats[stat] >= 0 ? '+' : ''}{sheet.mechanics.stats[stat] ?? 0}</span>
          </div>
        {/each}
      </div>
      <h3>Movimientos</h3>
      <ul class="move-list">
        {#each selectedMoves as move}
          <li>{move?.name}</li>
        {/each}
      </ul>
      <p class="hint">
        {sheet.identity.character_name || '—'}
        {#if sheet.identity.pronouns} · {sheet.identity.pronouns}{/if}
        · {playbook.backgrounds.find((b) => b.id === sheet.identity.background_id)?.name ?? 'sin background'}
      </p>

    {:else if active === 'identity'}
      <h2>Identidad</h2>
      <p class="lede">Nombre, background e instinct. Elige leyendo la prosa completa, como en el playbook.</p>

      <Field
        label="Nombre"
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
        Quiero especificar pronombres (opcional)
      </label>
      {#if showPronouns}
        <Field
          label="Pronombres"
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
            label="Pronombres (personalizado)"
            value={sheet.identity.pronouns}
            disabled={readonly}
            onchange={(v) => patch((d) => { d.identity.pronouns = String(v) })}
          />
        {/if}
      {/if}

      <h3>Background <span class="req">elige 1</span></h3>
      <div class="choices">
        {#each playbook.backgrounds as bg}
          <BackgroundCard
            background={bg}
            {playbook}
            selected={sheet.identity.background_id === bg.id}
            disabled={readonly}
            fieldValues={sheet.identity.background_id === bg.id ? backgroundFieldValues : {}}
            onSelect={() => selectBackground(bg)}
            onFieldChange={(key, value) => setBackgroundField(bg, key, value)}
          />
        {/each}
      </div>

      <h3>Instinct <span class="req">elige 1</span></h3>
      <div class="choices">
        {#each playbook.instincts as instinct}
          <ChoiceCard
            title={instinct.label}
            selected={sheet.identity.instinct_id === instinct.id}
            disabled={readonly}
            ruleText={instinct.description}
            onclick={() => selectInstinct(instinct.id)}
          />
        {/each}
      </div>

      <h3>Origen</h3>
      <Field
        label="Lugar de origen"
        type="single_choice"
        options={playbook.origins.map((o) => ({ id: o.id, label: o.label }))}
        value={sheet.identity.origin_id ?? ''}
        disabled={readonly}
        onchange={(v) =>
          patch((d) => {
            d.identity.origin_id = String(v) || null
          })}
      />
      {#if sheet.identity.origin_id}
        {@const origin = playbook.origins.find((o) => o.id === sheet.identity.origin_id)}
        {#if origin?.name_options?.length}
          <div class="name-examples">
            <p class="nested-label">Nombres de ejemplo</p>
            <div class="name-picks">
              {#each origin.name_options as opt}
                <button
                  type="button"
                  class="name-pick"
                  class:on={sheet.identity.character_name === opt.label || sheet.identity.character_name === opt.id}
                  disabled={readonly}
                  onclick={() =>
                    patch((d) => {
                      d.identity.name_source = 'suggested'
                      d.identity.character_name = opt.label
                    })}
                >
                  {opt.label}
                </button>
              {/each}
            </div>
            <p class="hint">También puedes escribir el nombre arriba; estos solo son sugerencias.</p>
          </div>
        {:else if origin}
          <p class="hint">Este origen no trae lista de nombres de ejemplo en el pack.</p>
        {/if}
      {/if}

    {:else if active === 'appearance'}
      <h2>Apariencia</h2>
      <p class="lede">Elige una opción por línea, o escribe algo propio si el campo lo permite.</p>
      {#each playbook.appearance_groups as group}
        <Field
          label={group.id}
          type={group.type}
          options={group.options}
          value={sheet.identity.appearance[group.id] ?? ''}
          disabled={readonly}
          onchange={(v) => patch((d) => { d.identity.appearance[group.id] = String(v) })}
        />
      {/each}

    {:else if active === 'stats'}
      <h2>Atributos</h2>
      <p class="lede">
        Asigna {playbook.base.stat_array.join(', ')}. Damage {playbook.base.damage_die} · HP máx {playbook.base.max_hp}.
      </p>
      <label class="field-inline">
        Orden de asignación (coma)
        <input bind:value={customStatOrder} disabled={readonly} />
      </label>
      <button
        type="button"
        class="action"
        disabled={readonly}
        onclick={() =>
          assignStats(
            playbook.base.stat_array,
            customStatOrder.split(',').map((s) => s.trim()).filter(Boolean),
          )}
      >
        Aplicar array
      </button>
      <div class="stats">
        {#each statOrder as stat}
          <Field
            label={stat}
            type="number"
            min={-1}
            max={3}
            value={sheet.mechanics.stats[stat] ?? 0}
            disabled={readonly}
            onchange={(v) => patch((d) => { d.mechanics.stats[stat] = Number(v) })}
          />
        {/each}
      </div>
      <Field
        label="HP actual"
        type="counter"
        min={0}
        max={sheet.mechanics.max_hp}
        value={sheet.mechanics.hp_current}
        disabled={readonly}
        onchange={(v) => patch((d) => { d.mechanics.hp_current = Number(v) })}
      />
      <Field
        label="Debilities"
        type="multi_choice"
        options={['weakened', 'dazed', 'miserable']}
        value={(['weakened', 'dazed', 'miserable'] as const).filter((k) => sheet.mechanics.debilities[k])}
        disabled={readonly}
        onchange={(v) => patch((d) => {
          const list = v as string[]
          d.mechanics.debilities = {
            weakened: list.includes('weakened'),
            dazed: list.includes('dazed'),
            miserable: list.includes('miserable'),
          }
        })}
      />

    {:else if active === 'moves'}
      <h2>Movimientos</h2>
      <p class="lede">
        Empiezas con {playbook.starting_move_rules.fixed.join(', ')}
        {#if playbook.starting_move_rules.background_grants} + el del background{/if},
        y eliges {playbook.starting_move_rules.free_choices} más de nivel 1.
      </p>
      <div class="choices">
        {#each level1Moves as move}
          {@const fixed = playbook.starting_move_rules.fixed.includes(move.id)}
          {@const bgGranted = (playbook.backgrounds
            .find((b) => b.id === sheet.identity.background_id)
            ?.grants ?? [])
            .some((g) => g.type === 'move' && g.id === move.id)}
          {@const checked = sheet.moves.selected.includes(move.id)}
          {@const filled = sheet.moves.selected.filter((id) => id === move.id).length}
          {@const boxes = movePrintedBoxes(move)}
          <ChoiceCard
            title={move.name}
            selected={checked}
            disabled={readonly || fixed || bgGranted}
            badge={fixed ? 'fijo' : bgGranted ? 'background' : undefined}
            ruleText={move.rule_text}
            {boxes}
            {filled}
            onclick={() => toggleMove(move, fixed, bgGranted)}
            onSlotClick={(i) => toggleMove(move, fixed, bgGranted, i)}
          />
        {/each}
      </div>

    {:else if active === 'possessions'}
      <h2>Posesiones especiales</h2>
      {#if possessions.fixed?.length}
        <h3>Fijas</h3>
        <div class="choices">
          {#each possessions.fixed as item}
            <div class="fixed-block">
              <ChoiceCard
                title={item.name}
                selected
                disabled
                badge="fija"
                ruleText={item.rule_text}
              />
              {#if nestedChoiceOptions(item).length}
                <div class="nested">
                  <p class="nested-label">Elige 1:</p>
                  {#each nestedChoiceOptions(item) as opt}
                    <label class="nested-opt">
                      <input
                        type="radio"
                        name={`nested-${item.id}`}
                        disabled={readonly}
                        checked={nestedSelected(item) === opt}
                        onchange={() => setNestedChoice(item.id, opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <h3>Elige {possessions.choose ?? 0}</h3>
      <div class="choices">
        {#each possessions.options ?? [] as item}
          {#if item.id !== 'custom'}
            <ChoiceCard
              title={item.name}
              selected={sheet.possessions.selected.includes(item.id)}
              disabled={readonly}
              ruleText={item.rule_text}
              meta={item.state?.tag_choice ? `Opciones: ${((item.state.tag_choice as { options?: string[] }).options ?? []).join(' / ')}` : undefined}
              onclick={() => togglePossession(item.id)}
            />
            {#if sheet.possessions.selected.includes(item.id) && (item.state?.tag_choice as { options?: string[] } | undefined)?.options}
              <div class="nested">
                <p class="nested-label">Detalle:</p>
                {#each (item.state.tag_choice as { options: string[] }).options as opt}
                  <label class="nested-opt">
                    <input
                      type="radio"
                      name={`tag-${item.id}`}
                      disabled={readonly}
                      checked={String((sheet.possessions.details as Record<string, unknown>)?.[`${item.id}:tag`] ?? '') === opt}
                      onchange={() =>
                        patch((d) => {
                          d.possessions.details = {
                            ...(d.possessions.details ?? {}),
                            [`${item.id}:tag`]: opt,
                          }
                        })}
                    />
                    <span>{opt}</span>
                  </label>
                {/each}
              </div>
            {/if}
          {/if}
        {/each}
      </div>

      {#if possessions.sacred_pouch_setup}
        <h3>Sacred pouch</h3>
        {#each Object.entries(possessions.sacred_pouch_setup) as [key, val]}
          {#if Array.isArray(val)}
            <Field
              label={key}
              type="single_choice"
              options={val.map((x) => ({ id: String(x), label: String(x) }))}
              value={String((sheet.possessions.details as Record<string, unknown>)?.[key] ?? '')}
              disabled={readonly}
              onchange={(v) =>
                patch((d) => {
                  d.possessions.details = { ...(d.possessions.details ?? {}), [key]: v }
                })}
            />
          {:else if val && typeof val === 'object' && 'type' in (val as object) && (val as { type: string }).type === 'counter'}
            {@const stock = val as { type: string; initial?: number }}
            {@const max = stock.initial ?? 3}
            <Field
              label={key === 'stock' ? `Stock (máx. ${max} al empezar)` : key}
              type="checkbox_group"
              max={max}
              value={
                Array.isArray((sheet.possessions.details as Record<string, unknown>)?.[key])
                  ? (sheet.possessions.details as Record<string, unknown>)[key]
                  : Array.from({ length: max }, () => false)
              }
              disabled={readonly}
              onchange={(v) =>
                patch((d) => {
                  d.possessions.details = { ...(d.possessions.details ?? {}), [key]: v }
                })}
            />
          {:else if val && typeof val === 'object' && 'options' in (val as object)}
            {@const trait = val as { options?: string[] }}
            <Field
              label={key}
              type="single_choice"
              options={(trait.options ?? []).map((x) => ({ id: x, label: x }))}
              value={String((sheet.possessions.details as Record<string, unknown>)?.[key] ?? '')}
              disabled={readonly}
              onchange={(v) =>
                patch((d) => {
                  d.possessions.details = { ...(d.possessions.details ?? {}), [key]: v }
                })}
            />
          {/if}
        {/each}
      {/if}

    {:else if active === 'setup'}
      <h2>Setup del playbook</h2>
      {#if playbook.playbook_setup}
        {#each Object.entries(playbook.playbook_setup) as [blockKey, blockVal]}
          <h3>{blockKey}</h3>
          {#if blockVal && typeof blockVal === 'object'}
            {#each Object.entries(blockVal as Record<string, unknown>) as [fieldKey, fieldVal]}
              {#if fieldVal && typeof fieldVal === 'object' && 'type' in (fieldVal as object)}
                {@const field = fieldVal as { type: string; options?: string[]; min?: number; max?: number }}
                <Field
                  label={fieldKey}
                  type={field.type}
                  min={field.min}
                  max={field.max}
                  options={(field.options ?? []).map((o) => ({ id: o, label: o }))}
                  value={
                    ((sheet.setup[blockKey] as Record<string, unknown> | undefined)?.[fieldKey] as
                      | string
                      | string[]
                      | undefined) ?? (field.type.startsWith('multi') ? [] : '')
                  }
                  disabled={readonly}
                  onchange={(v) =>
                    patch((d) => {
                      const block = { ...((d.setup[blockKey] as Record<string, unknown>) ?? {}) }
                      block[fieldKey] = v
                      d.setup[blockKey] = block
                    })}
                />
              {/if}
            {/each}
          {/if}
        {/each}
      {:else}
        <p class="help">Este playbook no tiene setup adicional normalizado.</p>
      {/if}

    {:else if active === 'introductions'}
      <h2>Introducciones</h2>
      <Field
        label="Contribución a Stonetop"
        value={sheet.session_zero_notes.contribution_to_stonetop ?? ''}
        disabled={readonly}
        onchange={(v) =>
          patch((d) => {
            d.session_zero_notes.contribution_to_stonetop = String(v)
          })}
      />
      <h3>NPC prompts</h3>
      {#each playbook.introductions?.npc_prompts ?? [] as prompt, i}
        <Field
          label={prompt}
          value={sheet.session_zero_notes.npc_connections?.[i]?.answer_name ?? ''}
          disabled={readonly}
          onchange={(v) =>
            patch((d) => {
              const list = [...(d.session_zero_notes.npc_connections ?? [])]
              list[i] = { prompt_id: `npc-${i}`, answer_name: String(v) }
              d.session_zero_notes.npc_connections = list
            })}
        />
      {/each}
      <h3>PC prompts</h3>
      {#each playbook.introductions?.pc_prompts ?? [] as prompt, i}
        <Field
          label={prompt}
          value={sheet.session_zero_notes.pc_connections?.[i]?.target_character_name ?? ''}
          disabled={readonly}
          onchange={(v) =>
            patch((d) => {
              const list = [...(d.session_zero_notes.pc_connections ?? [])]
              list[i] = {
                prompt_id: `pc-${i}`,
                target_character_name: String(v),
                target_character_id: null,
              }
              d.session_zero_notes.pc_connections = list
            })}
        />
      {/each}

    {:else if active === 'inserts'}
      <h2>Inserts</h2>
      {#each relevantInserts as insert}
        <article class="insert">
          <h3>{insert.name}</h3>
          {#if insert.rule_text}
            <div class="insert-prose">{@html renderRuleProse(insert.rule_text)}</div>
          {:else if insert.note}
            <p class="help">{insert.note}</p>
          {/if}
          {#if insert.id === 'animal-companion' && Array.isArray(insert.types)}
            <Field
              label="Tipo"
              type="single_choice"
              options={(insert.types as { id: string }[]).map((t) => ({ id: t.id, label: t.id }))}
              value={String((sheet.inserts[insert.id] as Record<string, unknown>)?.type ?? '')}
              disabled={readonly}
              onchange={(v) =>
                patch((d) => {
                  d.inserts[insert.id] = { ...((d.inserts[insert.id] as object) ?? {}), type: v }
                })}
            />
            <Field
              label="Nombre"
              value={String((sheet.inserts[insert.id] as Record<string, unknown>)?.name ?? '')}
              disabled={readonly}
              onchange={(v) =>
                patch((d) => {
                  d.inserts[insert.id] = { ...((d.inserts[insert.id] as object) ?? {}), name: v }
                })}
            />
          {:else if insert.id === 'initiates-of-danu' && insert.members}
            <Field
              label="Initiates (2–3)"
              type="multi_choice"
              min={2}
              max={3}
              options={insert.members.map((m) => ({ id: m.id, label: m.name }))}
              value={((sheet.inserts[insert.id] as Record<string, unknown>)?.selected as string[]) ?? []}
              disabled={readonly}
              onchange={(v) => patch((d) => { d.inserts[insert.id] = { selected: v } })}
            />
          {:else}
            <Field
              label="Notas"
              value={String((sheet.inserts[insert.id] as Record<string, unknown>)?.notes ?? '')}
              disabled={readonly}
              onchange={(v) =>
                patch((d) => {
                  d.inserts[insert.id] = { ...((d.inserts[insert.id] as object) ?? {}), notes: v }
                })}
            />
          {/if}
        </article>
      {/each}

    {:else if active === 'arcana'}
      <ArcanaPanel
        {grants}
        cards={arcanaCards}
        states={arcanaStates}
        {readonly}
        onStateChange={onArcanaStateChange}
      />
    {/if}
  </main>

  <footer class="pager">
    <button type="button" disabled={pageIndex <= 1} onclick={() => goto(-1)}>← Anterior</button>
    <span class="pos">{SECTION_LABELS[active]} · {pageIndex}/{flow.length}</span>
    {#if pageIndex < flow.length}
      <button type="button" onclick={() => goto(1)}>Siguiente →</button>
    {:else if creating && readyToFinish && !readonly}
      <button type="button" class="finish" onclick={finishCreation}>Terminar creación →</button>
    {:else}
      <span></span>
    {/if}
  </footer>

  {#if creating && readyToFinish && !readonly && pageIndex < flow.length}
    <div class="finish-bar">
      <button type="button" class="finish" onclick={finishCreation}>Terminar creación →</button>
    </div>
  {/if}
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 70vh;
  }
  .sheet.mode-creation {
    --sheet-chrome: #92400e;
  }
  .sheet.mode-play {
    --sheet-chrome: #166534;
  }
  .sheet-header {
    display: grid;
    gap: 0.55rem;
    padding-bottom: 0.55rem;
    border-bottom: 2px solid color-mix(in srgb, var(--sheet-chrome) 35%, var(--line));
  }
  .brand-line {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
  }
  .mode-label {
    margin: 0 0 0.15rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--sheet-chrome);
  }
  h1 {
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.2;
    font-weight: 700;
  }
  .sub {
    margin: 0.15rem 0 0;
    color: var(--ink-muted);
    font-size: 0.9rem;
  }
  .mode {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.25rem 0.55rem;
    border-radius: 6px;
    white-space: nowrap;
    align-self: flex-start;
  }
  .mode.creating {
    background: #fef3c7;
    color: #92400e;
  }
  .mode.playing {
    background: #dcfce7;
    color: #166534;
  }
  .pills {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.35rem;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding: 0.1rem 0 0.15rem;
    overscroll-behavior-x: contain;
  }
  .pills::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
  .pill {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--line);
    background: var(--paper-2);
    border-radius: 999px;
    padding: 0.3rem 0.7rem;
    font: inherit;
    font-size: 0.82rem;
    line-height: 1.2;
    white-space: nowrap;
    cursor: pointer;
    color: var(--ink);
  }
  .pill.active {
    border-color: var(--c, var(--accent));
    background: color-mix(in srgb, var(--c, var(--accent)) 14%, white);
    font-weight: 600;
  }
  .pill em {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: #c4b5a0;
    flex-shrink: 0;
  }
  .pill em[data-s='in_progress'] {
    background: #d97706;
  }
  .pill em[data-s='complete'] {
    background: #15803d;
  }
  .page {
    flex: 1;
    border-top: 3px solid var(--section-color, var(--accent));
    padding-top: 0.9rem;
  }
  .page h2 {
    margin: 0 0 0.35rem;
    color: var(--section-color, var(--ink));
  }
  .page h3 {
    margin: 1.25rem 0 0.55rem;
    font-size: 1rem;
  }
  .lede,
  .help,
  .hint {
    color: var(--ink-muted);
    font-size: 0.92rem;
  }
  .req {
    font-weight: 500;
    color: var(--ink-muted);
    font-size: 0.85rem;
  }
  .choices {
    display: grid;
    gap: 0.75rem;
  }
  .name-examples {
    margin: 0.25rem 0 1rem;
    padding: 0.75rem 0.85rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--paper-2);
  }
  .name-picks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .name-pick {
    border: 1px solid var(--line);
    background: white;
    border-radius: 999px;
    padding: 0.3rem 0.7rem;
    font: inherit;
    font-size: 0.88rem;
    cursor: pointer;
    color: var(--ink);
  }
  .name-pick.on {
    border-color: var(--section-color, var(--accent));
    background: color-mix(in srgb, var(--section-color, var(--accent)) 12%, white);
    font-weight: 600;
  }
  .name-pick:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .pronoun-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--ink-muted);
    margin: 0.25rem 0 0.85rem;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .field-inline {
    display: grid;
    gap: 0.35rem;
    margin-bottom: 0.75rem;
  }
  .action,
  .pager button,
  .finish {
    font: inherit;
    border-radius: 8px;
    padding: 0.5rem 0.9rem;
    cursor: pointer;
  }
  .action {
    border: 1px solid var(--line);
    background: var(--paper-2);
    margin-bottom: 0.85rem;
  }
  .finish {
    border: 0;
    background: #15803d;
    color: white;
    font-weight: 600;
  }
  .fixed-block {
    display: grid;
    gap: 0.45rem;
  }
  .nested {
    margin: 0 0.25rem 0.5rem 1.4rem;
    padding: 0.55rem 0.75rem;
    border-left: 2px solid var(--line);
    display: grid;
    gap: 0.35rem;
  }
  .nested-label {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
  .nested-opt {
    display: flex;
    gap: 0.45rem;
    align-items: flex-start;
    font-size: 0.92rem;
  }
  .insert {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 0.85rem;
    margin-bottom: 0.85rem;
    background: var(--paper-2);
  }
  .insert-prose {
    font-size: 0.88rem;
    line-height: 1.45;
    color: var(--ink);
    margin-bottom: 0.75rem;
    max-height: 12rem;
    overflow: auto;
  }
  .insert-prose :global(p) {
    margin: 0 0 0.45rem;
  }
  .insert-prose :global(p:last-child) {
    margin-bottom: 0;
  }
  .insert-prose :global(em) {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-weight: 500;
  }
  .insert-prose :global(strong) {
    font-weight: 700;
  }
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
  .stat-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.6rem;
    border-radius: 10px;
    background: var(--paper-2);
    border: 1px solid var(--line);
  }
  .stat-block .k {
    font-size: 0.75rem;
    color: var(--ink-muted);
    text-transform: uppercase;
  }
  .stat-block .v {
    font-size: 1.25rem;
    font-weight: 700;
  }
  .overview-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .stat-pill {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    background: var(--section-color, var(--accent));
    color: white;
    font-size: 0.85rem;
  }
  .stat-pill .k {
    font-weight: 700;
  }
  .move-list {
    padding-left: 1.1rem;
  }
  .pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.5rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--line);
  }
  .pager button {
    border: 1px solid var(--line);
    background: var(--paper-2);
  }
  .pager .pos {
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
  .finish-bar {
    display: flex;
    justify-content: flex-end;
  }
  @media (max-width: 700px) {
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
