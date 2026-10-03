<script lang="ts">
  import type { ArcanaCard } from '../content/types'
  import type { LocalArcanaState, LocalGrant } from '../db/idb'
  import { canSeeReverse, visibleArcana } from '../grant/visibility'
  import { renderRuleProse } from '../content/renderProse'
  import Field from './Field.svelte'

  interface Props {
    grants: LocalGrant[]
    cards: ArcanaCard[]
    states: LocalArcanaState[]
    readonly?: boolean
    onStateChange?: (state: LocalArcanaState) => void
  }

  let { grants, cards, states, readonly = false, onStateChange }: Props = $props()

  const visible = $derived(visibleArcana(grants, cards))

  function stateFor(grantId: string | undefined) {
    if (!grantId) return null
    return states.find((s) => s.grant_id === grantId) ?? null
  }

  function grantIdFor(card: ArcanaCard) {
    const type = card.type === 'major_arcanum' ? 'arcana_major' : 'arcana_minor'
    return grants.find((g) => g.content_type === type && g.content_id === card.id)?.id
  }
</script>

<section class="arcana">
  <h2>Arcana</h2>
  {#if visible.length === 0}
    <p class="empty">El GM aún no te ha enviado arcana.</p>
  {:else}
    <div class="grid">
      {#each visible as { card, visibility }}
        {@const gid = grantIdFor(card)}
        {@const st = stateFor(gid)}
        <article class="card">
          <header>
            <h3>{card.name}</h3>
            <span class="tag">{card.type === 'major_arcanum' ? 'Major' : 'Minor'}</span>
            <span class="tag">{visibility === 'full' ? 'Completo' : 'Solo frente'}</span>
          </header>

          {#if card.rule_text && (visibility === 'full' || !card.controls?.length)}
            <div class="block prose">
              {@html renderRuleProse(card.rule_text)}
            </div>
          {:else if card.rule_text}
            <div class="block prose front-only">
              {@html renderRuleProse(card.rule_text.split('\n\n')[0])}
              {#if visibility !== 'full'}
                <p class="meta">El reverso completo se revela cuando el GM cambie la visibilidad a full.</p>
              {/if}
            </div>
          {/if}

          {#if card.controls?.length}
            <div class="block">
              <h4>Frente / controles</h4>
              {#each card.controls as ctrl}
                {#if ctrl.status === 'pending_interpretation' || !ctrl.type}
                  <p class="pending">{ctrl.key}: pendiente de interpretación</p>
                {:else}
                  <Field
                    label={ctrl.key}
                    type={ctrl.type}
                    max={ctrl.max ?? ctrl.count ?? ctrl.slots}
                    min={ctrl.min}
                    disabled={readonly}
                    value={st?.progress?.[ctrl.key] ?? (ctrl.type === 'checkbox_group' ? [] : 0)}
                    onchange={(v) => {
                      if (!st || !onStateChange) return
                      onStateChange({
                        ...st,
                        progress: { ...st.progress, [ctrl.key]: v },
                        dirty: true,
                        updatedAt: new Date().toISOString(),
                      })
                    }}
                  />
                {/if}
              {/each}
            </div>
          {/if}

          {#if card.type === 'major_arcanum'}
            <div class="block">
              <h4>Progreso</h4>
              {#if card.progress}
                <p class="meta">
                  slots: {String(card.progress.slots ?? '?')} · type: {String(card.progress.type ?? '?')}
                </p>
                <Field
                  label="Marcas"
                  type="checkbox_group"
                  max={Number(card.progress.slots ?? 0)}
                  disabled={readonly}
                  value={st?.progress?.marks ?? []}
                  onchange={(v) => {
                    if (!st || !onStateChange) return
                    onStateChange({
                      ...st,
                      progress: { ...st.progress, marks: v },
                      dirty: true,
                      updatedAt: new Date().toISOString(),
                    })
                  }}
                />
              {/if}
            </div>

            {#if canSeeReverse(visibility)}
              <div class="block reverse">
                <h4>Misterios / consecuencias</h4>
                {#if card.mechanic_notes?.length}
                  <ul>
                    {#each card.mechanic_notes as note}
                      <li>{note}</li>
                    {/each}
                  </ul>
                {/if}
                {#if card.consequences && card.consequences.status === 'pending_interpretation'}
                  <p class="pending">Consecuencias pendientes de verificación visual.</p>
                {:else if card.consequences?.count}
                  <Field
                    label="Consecuencias"
                    type="checkbox_group"
                    max={Number(card.consequences.count)}
                    disabled={readonly}
                    value={Array.isArray(st?.consequences) ? st.consequences : []}
                    onchange={(v) => {
                      if (!st || !onStateChange) return
                      onStateChange({
                        ...st,
                        consequences: v as unknown[],
                        dirty: true,
                        updatedAt: new Date().toISOString(),
                      })
                    }}
                  />
                {/if}
                {#if card.resources?.length}
                  {#each card.resources as res}
                    <Field
                      label={String(res.key)}
                      type={String(res.type ?? 'counter')}
                      max={Number(res.max ?? res.slots ?? undefined)}
                      disabled={readonly}
                      value={st?.state?.[String(res.key)] ?? 0}
                      onchange={(v) => {
                        if (!st || !onStateChange) return
                        onStateChange({
                          ...st,
                          state: { ...st.state, [String(res.key)]: v },
                          dirty: true,
                          updatedAt: new Date().toISOString(),
                        })
                      }}
                    />
                  {/each}
                {/if}
              </div>
            {:else}
              <p class="locked">Reverso bloqueado — el GM debe liberar `full`.</p>
            {/if}
          {/if}

          {#if card.pending?.length}
            <p class="pending">! {card.pending.join(' ')}</p>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .arcana h2 {
    margin: 0 0 0.75rem;
  }
  .empty,
  .locked,
  .pending {
    color: var(--ink-muted);
  }
  .pending {
    color: var(--warn);
  }
  .grid {
    display: grid;
    gap: 1rem;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 1rem;
    background: var(--paper-2);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  h3 {
    margin: 0;
    flex: 1;
  }
  .tag {
    font-size: 0.75rem;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    background: var(--chip);
  }
  .block {
    margin-top: 0.75rem;
  }
  .reverse {
    border-top: 1px dashed var(--line);
    padding-top: 0.75rem;
  }
  .meta {
    font-size: 0.85rem;
    color: var(--ink-muted);
  }
  .prose :global(p) {
    margin: 0 0 0.5rem;
    line-height: 1.45;
    font-size: 0.92rem;
  }
  .prose :global(p:last-child) {
    margin-bottom: 0;
  }
  .prose :global(em) {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-weight: 500;
  }
  .prose :global(strong) {
    font-weight: 700;
  }
  .prose.front-only {
    opacity: 0.95;
  }
</style>
