<!--
  Non-color status cue for warnings / success (WCAG: don't rely on color alone).
-->
<script lang="ts">
  interface Props {
    kind?: 'warn' | 'ok'
    /** Accessible label when the cue is meaningful on its own. */
    label?: string
  }

  let { kind = 'warn', label }: Props = $props()
</script>

<span
  class="cue"
  class:warn={kind === 'warn'}
  class:ok={kind === 'ok'}
  aria-hidden={label ? undefined : true}
  aria-label={label}
  title={label}
>{kind === 'warn' ? '!' : '✓'}</span>

<style>
  .cue {
    display: inline-block;
    font-weight: 700;
    font-style: normal;
    line-height: 1;
    margin-inline-end: 0.2em;
  }
  .cue.warn {
    color: var(--danger, #8c2f22);
  }
  .cue.ok {
    color: var(--accent);
  }
</style>
