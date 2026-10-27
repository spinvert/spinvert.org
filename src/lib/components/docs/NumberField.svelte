<script lang="ts">
  interface Props {
    label: string;
    value: number;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    /** Show a range slider below the number input */
    slider?: boolean;
    hint?: string;
  }

  let { label, value = $bindable(), unit, min, max, step = 1, slider = false, hint }: Props = $props();

  const id = `field-${Math.random().toString(36).slice(2)}`;
</script>

<div class="text-sm">
  <label for={id} class="mb-1 block text-muted-foreground">{label}</label>
  <div class="flex items-center gap-2">
    <input
      {id}
      type="number"
      bind:value
      {min}
      {max}
      {step}
      class="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
    {#if unit}
      <span class="w-12 shrink-0 text-xs text-muted-foreground">{unit}</span>
    {/if}
  </div>
  {#if slider}
    <input type="range" bind:value {min} {max} {step} class="mt-1 w-full accent-primary" aria-label={label} />
  {/if}
  {#if hint}
    <p class="mt-1 text-xs text-muted-foreground">{hint}</p>
  {/if}
</div>
