<script lang="ts">
  interface Props {
    label: string;
    value: string;
    unit?: string;
    hint?: string;
  }

  let { label, value, unit, hint }: Props = $props();
</script>

<div class="rounded-md border px-3 py-2">
  <p class="text-xs text-muted-foreground">{label}</p>
  <p class="text-lg font-semibold tabular-nums">
    {value}
    {#if unit}<span class="text-sm font-normal text-muted-foreground">{unit}</span>{/if}
  </p>
  {#if hint}<p class="text-xs text-muted-foreground">{hint}</p>{/if}
</div>
