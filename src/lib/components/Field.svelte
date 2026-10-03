<script lang="ts">
  interface Option {
    id: string
    label: string
  }

  interface Props {
    label?: string
    type?: string
    value?: unknown
    options?: Option[] | string[]
    min?: number
    max?: number
    disabled?: boolean
    onchange?: (value: unknown) => void
  }

  let {
    label = '',
    type = 'text',
    value = null,
    options = [],
    min,
    max,
    disabled = false,
    onchange,
  }: Props = $props()

  function normOptions(): Option[] {
    return (options ?? []).map((o) =>
      typeof o === 'string' ? { id: o, label: o } : o,
    )
  }

  function emit(v: unknown) {
    onchange?.(v)
  }
</script>

<label class="field">
  {#if label}
    <span class="label">{label}</span>
  {/if}

  {#if type === 'text' || type === 'content_reference'}
    <input
      type="text"
      {disabled}
      value={typeof value === 'string' ? value : ''}
      oninput={(e) => emit(e.currentTarget.value)}
    />
  {:else if type === 'number' || type === 'counter' || type === 'uses'}
    <input
      type="number"
      {disabled}
      {min}
      {max}
      value={typeof value === 'number' ? value : 0}
      oninput={(e) => emit(Number(e.currentTarget.value))}
    />
  {:else if type === 'checkbox'}
    <input
      type="checkbox"
      {disabled}
      checked={!!value}
      onchange={(e) => emit(e.currentTarget.checked)}
    />
  {:else if type === 'single_choice' || type === 'single_choice_with_custom'}
    <select
      {disabled}
      value={typeof value === 'string' ? value : ''}
      onchange={(e) => emit(e.currentTarget.value)}
    >
      <option value="">—</option>
      {#each normOptions() as opt}
        <option value={opt.id}>{opt.label}</option>
      {/each}
      {#if type === 'single_choice_with_custom'}
        <option value="__custom__">Custom…</option>
      {/if}
    </select>
  {:else if type === 'multi_choice' || type === 'multi_choice_with_custom'}
    <div class="checks">
      {#each normOptions() as opt}
        {@const selected = Array.isArray(value) ? value.includes(opt.id) : false}
        <label class="check">
          <input
            type="checkbox"
            {disabled}
            checked={selected}
            onchange={(e) => {
              const current = Array.isArray(value) ? [...value] : []
              if (e.currentTarget.checked) current.push(opt.id)
              else {
                const i = current.indexOf(opt.id)
                if (i >= 0) current.splice(i, 1)
              }
              if (typeof max === 'number' && current.length > max) return
              emit(current)
            }}
          />
          {opt.label}
        </label>
      {/each}
    </div>
  {:else if type === 'checkbox_group'}
    <div class="checks">
      {#each Array(max ?? 0) as _, i}
        {@const marks = Array.isArray(value) ? value : []}
        <label class="check">
          <input
            type="checkbox"
            {disabled}
            checked={!!marks[i]}
            onchange={(e) => {
              const next = Array.from({ length: max ?? 0 }, (_, j) =>
                j === i ? e.currentTarget.checked : !!marks[j],
              )
              emit(next)
            }}
          />
          {i + 1}
        </label>
      {/each}
    </div>
  {:else}
    <!-- Unknown pack control → blank write-in (paper sheet). -->
    <input
      type="text"
      {disabled}
      value={typeof value === 'string' ? value : value == null ? '' : String(value)}
      oninput={(e) => emit(e.currentTarget.value)}
    />
  {/if}
</label>

<style>
  .field {
    display: grid;
    gap: 0.35rem;
    margin-bottom: 0.75rem;
  }
  .label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink-muted);
  }
  input[type='text'],
  input[type='number'],
  select {
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--paper-2);
    color: var(--ink);
    font: inherit;
  }
  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }
  .check {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.95rem;
  }
</style>
