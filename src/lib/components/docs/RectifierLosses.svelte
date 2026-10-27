<script lang="ts">
  import { board } from "$lib/calc/board";
  import { rectifierLosses } from "$lib/calc/generator";
  import { type Series, fmt } from "./chart";
  import LineChart from "./LineChart.svelte";
  import NumberField from "./NumberField.svelte";
  import Stat from "./Stat.svelte";

  let power = $state(150);
  let forwardVoltage = $state(0.8);
  let resistance = $state(5);
  let voltage = $state(12);

  const valid = $derived(
    [power, forwardVoltage, resistance, voltage].every((v) => typeof v === "number" && v > 0),
  );

  const rect = $derived({ diodeForwardVoltage: forwardVoltage, mosfetResistance: resistance / 1000 });

  /** Efficiency of the rectifier delivering the given power at the given DC voltage */
  function efficiency(active: boolean, dcVoltage: number) {
    const current = power / dcVoltage;
    return (power / (power + rectifierLosses(rect, active, current))) * 100;
  }

  // Start the curves where the current reaches the rating of the rectifier
  const minVoltage = $derived(Math.max(1, power / board.rectifierMaxCurrent));
  const voltages = $derived(
    Array.from({ length: 100 }, (_, i) => minVoltage + ((board.maxInputVoltage - minVoltage) * i) / 99),
  );

  const series: Series[] = $derived(
    valid
      ? [
          {
            id: "active",
            label: "Active rectification (MOSFETs)",
            color: "var(--viz-1)",
            points: voltages.map((v): [number, number] => [v, efficiency(true, v)]),
          },
          {
            id: "diode",
            label: "Diode rectifier",
            color: "var(--viz-3)",
            points: voltages.map((v): [number, number] => [v, efficiency(false, v)]),
          },
        ]
      : [],
  );

  const current = $derived(power / voltage);
</script>

<div class="not-prose my-8 rounded-lg border p-4 sm:p-6">
  <div class="grid gap-6 sm:grid-cols-4">
    <NumberField label="Power" bind:value={power} unit="W" min={10} max={1000} step={10} slider />
    <NumberField label="Rectified voltage" bind:value={voltage} unit="V" min={2} max={60} step={1} slider />
    <NumberField label="Diode forward voltage" bind:value={forwardVoltage} unit="V" min={0.2} max={1.5} step={0.05} />
    <NumberField label="MOSFET on-resistance" bind:value={resistance} unit="mΩ" min={0.5} max={50} step={0.5} />
  </div>

  {#if valid}
    <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="DC current" value={fmt(current)} unit="A" />
      <Stat label="Losses with diodes" value={fmt(rectifierLosses(rect, false, current))} unit="W" />
      <Stat label="Losses with MOSFETs" value={fmt(rectifierLosses(rect, true, current))} unit="W" />
      <Stat
        label="Efficiency gain"
        value={fmt(efficiency(true, voltage) - efficiency(false, voltage))}
        unit="%-points"
      />
    </div>

    <LineChart
      title={`Rectifier efficiency at ${fmt(power)} W over rectified voltage`}
      {series}
      xLabel="Rectified voltage (V)"
      yLabel="Efficiency (%)"
      xUnit="V"
      yUnit="%"
      xMax={board.maxInputVoltage}
      yMin={Math.floor(Math.min(...series.flatMap((s) => s.points.map(([, y]) => y))) / 10) * 10}
      yMax={100}
      markers={[
        { x: voltage, y: efficiency(true, voltage), color: "var(--viz-1)" },
        { x: voltage, y: efficiency(false, voltage), color: "var(--viz-3)" },
      ]}
      height={260}
    />
    <p class="text-xs text-muted-foreground">
      Losses of the rectifier only. The generator windings cause additional losses that are the
      same in both cases.
    </p>
  {/if}
</div>
