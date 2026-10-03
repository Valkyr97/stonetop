<script lang="ts">
  import type { CharacterState, Playbook } from '../../../content/types'
  import SoftMd from '../../../components/SoftMd.svelte'

  interface Props {
    playbook: Playbook
    sheet: CharacterState
    readonly?: boolean
    onAnswer: (n: number, value: string) => void
  }

  let { playbook, sheet, readonly = false, onAnswer }: Props = $props()

  const answers = $derived(
    ((sheet.setup.introductions as Record<string, string> | undefined) ?? {}) as Record<string, string>,
  )
</script>

<h2>Introductions</h2>
{#if playbook.introductions?.intro}
  <div class="lede"><SoftMd text={playbook.introductions.intro} /></div>
{:else}
  <p class="lede">
    Wait here for everyone else. When everyone's ready, take turns introducing your characters.
  </p>
{/if}
<ol class="intro-steps">
  {#each playbook.introductions?.steps ?? [] as introStep (introStep.n)}
    <li>
      <span class="step-n">{introStep.n}</span>
      <div>
        <SoftMd text={introStep.text} />
        {#if introStep.questions?.length}
          <ul class="q-list">
            {#each introStep.questions as q}
              <li>{q}</li>
            {/each}
          </ul>
        {/if}
        <textarea
          class="intro-note"
          rows="2"
          placeholder="Notes (optional)…"
          disabled={readonly}
          value={answers[String(introStep.n)] ?? ''}
          oninput={(e) => onAnswer(introStep.n, e.currentTarget.value)}
        ></textarea>
      </div>
    </li>
  {/each}
</ol>
