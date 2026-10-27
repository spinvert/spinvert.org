<script lang="ts">
  import { type Band, type Marker, type Series, fmt, interpolate, ticks } from "./chart";

  interface Props {
    title: string;
    series: Series[];
    xLabel: string;
    yLabel: string;
    xMax?: number;
    yMin?: number;
    yMax?: number;
    bands?: Band[];
    markers?: Marker[];
    /** Unit appended to x value in the tooltip */
    xUnit?: string;
    /** Unit appended to y values in the tooltip */
    yUnit?: string;
    height?: number;
  }

  let {
    title,
    series,
    xLabel,
    yLabel,
    xMax,
    yMin = 0,
    yMax,
    bands = [],
    markers = [],
    xUnit = "",
    yUnit = "",
    height = 300,
  }: Props = $props();

  // Width before the first measurement (server-side rendering)
  let width = $state(720);
  const margin = { top: 12, right: 16, bottom: 44, left: 56 };
  const plotWidth = $derived(Math.max(100, width - margin.left - margin.right));
  const plotHeight = $derived(height - margin.top - margin.bottom);

  const allPoints = $derived(series.flatMap((s) => s.points));
  const xTicks = $derived(ticks(0, xMax ?? Math.max(...allPoints.map(([x]) => x), 1), width < 480 ? 4 : 6));
  const yTicks = $derived(ticks(yMin, yMax ?? Math.max(...allPoints.map(([, y]) => y), yMin + 1), 5));

  const sx = (x: number) => margin.left + (x / xTicks.max) * plotWidth;
  const sy = (y: number) => margin.top + plotHeight - ((y - yMin) / (yTicks.max - yMin)) * plotHeight;

  const path = (points: [number, number][]) =>
    points.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join("");

  const peak = (points: [number, number][]) => points.reduce((a, b) => (b[1] > a[1] ? b : a), points[0]);

  const legendSeries = $derived(series.filter((s) => s.legend !== false));

  // Hover state: x value under the pointer
  let hoverX = $state<number | undefined>(undefined);
  const hoverValues = $derived(
    hoverX === undefined
      ? []
      : legendSeries
          .map((s) => ({ series: s, y: interpolate(s.points, hoverX!) }))
          .filter((v): v is { series: Series; y: number } => v.y !== undefined),
  );

  function onPointerMove(event: PointerEvent) {
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const px = event.clientX - rect.left;
    const x = ((px - margin.left) / plotWidth) * xTicks.max;
    hoverX = x >= 0 && x <= xTicks.max ? x : undefined;
  }

  const clipId = `clip-${Math.random().toString(36).slice(2)}`;
</script>

<figure class="not-prose my-6">
  <figcaption class="mb-2 text-sm font-medium">{title}</figcaption>
  {#if legendSeries.length > 1}
    <ul class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {#each legendSeries as s (s.id)}
        <li class="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke={s.color}
              stroke-width="2"
              stroke-dasharray={s.dashed ? "4 3" : undefined}
            />
          </svg>
          {s.label}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="relative" bind:clientWidth={width}>
    <svg
      {width}
      {height}
      class="block touch-pan-y select-none"
      role="img"
      aria-label={title}
      onpointermove={onPointerMove}
      onpointerleave={() => (hoverX = undefined)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={margin.left} y={margin.top - 4} width={plotWidth} height={plotHeight + 4} />
        </clipPath>
      </defs>

      {#each bands as band, i (i)}
        {@const x0 = sx(Math.max(0, band.from))}
        {@const x1 = sx(Math.min(xTicks.max, band.to))}
        {#if x1 > x0}
          <rect
            x={x0}
            y={margin.top}
            width={x1 - x0}
            height={plotHeight}
            fill={i % 2 ? "transparent" : "var(--viz-wash)"}
          />
          <text x={(x0 + x1) / 2} y={margin.top + 12} text-anchor="middle" class="fill-muted-foreground text-[10px]">
            {x1 - x0 > band.label.length * 5.5 ? band.label : ""}
          </text>
        {/if}
      {/each}

      <!-- Grid and axes -->
      {#each yTicks.values as tick (tick)}
        <line x1={margin.left} x2={margin.left + plotWidth} y1={sy(tick)} y2={sy(tick)} stroke="var(--viz-grid)" />
        <text x={margin.left - 8} y={sy(tick)} dy="0.32em" text-anchor="end" class="fill-muted-foreground text-[11px]">
          {fmt(tick)}
        </text>
      {/each}
      {#each xTicks.values as tick (tick)}
        <text x={sx(tick)} y={margin.top + plotHeight + 16} text-anchor="middle" class="fill-muted-foreground text-[11px]">
          {fmt(tick)}
        </text>
      {/each}
      <text x={margin.left + plotWidth / 2} y={height - 6} text-anchor="middle" class="fill-muted-foreground text-xs">
        {xLabel}
      </text>
      <text
        transform={`translate(14 ${margin.top + plotHeight / 2}) rotate(-90)`}
        text-anchor="middle"
        class="fill-muted-foreground text-xs"
      >
        {yLabel}
      </text>

      <g clip-path={`url(#${clipId})`}>
        {#each series as s (s.id)}
          <path
            d={path(s.points)}
            fill="none"
            stroke={s.color}
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
            stroke-dasharray={s.dashed ? "6 4" : undefined}
          />
          {#if s.markers}
            {#each s.points as [x, y], i (i)}
              <circle cx={sx(x)} cy={sy(y)} r="4" fill={s.color} stroke="var(--background)" stroke-width="2" />
            {/each}
          {/if}
        {/each}
        {#each markers as m, i (i)}
          <circle cx={sx(m.x)} cy={sy(m.y)} r="4.5" fill={m.color} stroke="var(--background)" stroke-width="2" />
        {/each}
      </g>

      {#each series as s (s.id)}
        {#if s.peakLabel && s.points.length}
          {@const [x, y] = peak(s.points)}
          {#if x <= xTicks.max && y <= yTicks.max}
            <text x={sx(x)} y={sy(y) - 6} text-anchor="middle" class="fill-muted-foreground text-[10px]">
              {s.peakLabel}
            </text>
          {/if}
        {/if}
      {/each}

      {#if hoverX !== undefined}
        <line
          x1={sx(hoverX)}
          x2={sx(hoverX)}
          y1={margin.top}
          y2={margin.top + plotHeight}
          stroke="var(--muted-foreground)"
          stroke-width="1"
        />
        {#each hoverValues as v (v.series.id)}
          {#if v.y >= yMin && v.y <= yTicks.max}
            <circle cx={sx(hoverX)} cy={sy(v.y)} r="4" fill={v.series.color} stroke="var(--background)" stroke-width="2" />
          {/if}
        {/each}
      {/if}
    </svg>

    {#if hoverX !== undefined && hoverValues.length}
      {@const left = sx(hoverX)}
      <div
        class="pointer-events-none absolute top-2 z-10 min-w-36 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
        style:left={left < width / 2 ? `${left + 12}px` : undefined}
        style:right={left >= width / 2 ? `${width - left + 12}px` : undefined}
      >
        <p class="mb-1 font-medium">{fmt(hoverX)} {xUnit}</p>
        {#each hoverValues as v (v.series.id)}
          <p class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-1.5">
              <span class="inline-block size-2 rounded-full" style:background={v.series.color}></span>
              {v.series.label}
            </span>
            <span class="tabular-nums">{fmt(v.y)} {yUnit}</span>
          </p>
        {/each}
      </div>
    {/if}
  </div>
</figure>
