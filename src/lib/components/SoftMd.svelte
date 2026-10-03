<!--
  Lightweight markdown for pack prose: **bold**, *italic*, and paragraphs.
  Enough for Splatbook intro / extras / move text without a full parser.
-->
<script lang="ts">
  interface Props {
    text: string
    inline?: boolean
  }
  let { text, inline = false }: Props = $props()

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function formatInline(s: string): string {
    let out = escapeHtml(s)
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    return out
  }

  const html = $derived.by(() => {
    const raw = text ?? ''
    if (inline) return formatInline(raw)
    const blocks = raw.split(/\n\n+/).map((p) => `<p>${formatInline(p).replace(/\n/g, '<br />')}</p>`)
    return blocks.join('')
  })
</script>

{#if inline}
  <span class="soft-md">{@html html}</span>
{:else}
  <div class="soft-md">{@html html}</div>
{/if}

<style>
  .soft-md :global(p) {
    margin: 0 0 0.5rem;
  }
  .soft-md :global(p:last-child) {
    margin-bottom: 0;
  }
</style>
