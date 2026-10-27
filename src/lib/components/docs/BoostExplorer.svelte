<script lang="ts">
  import { board } from "$lib/calc/board";
  import { boostOperatingPoint, inductorCurrentWaveform } from "$lib/calc/boost";
  import { type Series, fmt } from "./chart";
  import LineChart from "./LineChart.svelte";
  import NumberField from "./NumberField.svelte";
  import Stat from "./Stat.svelte";

  const conv = { inductance: board.boostInductance, frequency: board.switchingFrequency };

  let inputVoltage = $state(24);
  let outputVoltage = $state(board.outputVoltage);
  let power = $state(200);

  const valid = $derived(
    [inputVoltage, outputVoltage, power].every((v) => typeof v === "number" && v > 0) &&
      inputVoltage < outputVoltage,
  );

  const op = $derived(valid ? boostOperatingPoint(conv, inputVoltage, outputVoltage, power) : undefined);

  const series: Series[] = $derived(
    op
      ? [
          {
            id: "inductor",
            label: "Inductor current",
            color: "var(--viz-1)",
            // Time in µs
            points: inductorCurrentWaveform(conv, op, 3).map(([t, i]): [number, number] => [t * 1e6, i]),
          },
          {
            id: "average",
            label: "Average (input) current",
            color: "var(--viz-2)",
            dashed: true,
            points: [
              [0, op.inputCurrent],
              [3e6 / conv.frequency, op.inputCurrent],
            ],
          },
        ]
      : [],
  );
</script>

<div class="not-prose my-8 rounded-lg border p-4 sm:p-6">
  <div class="grid gap-6 sm:grid-cols-3">
    <NumberField label="Input voltage" bind:value={inputVoltage} unit="V" min={1} max={57} step={0.5} slider />
    <NumberField label="Output voltage" bind:value={outputVoltage} unit="V" min={40} max={58} step={0.5} slider />
    <NumberField label="Power" bind:value={power} unit="W" min={5} max={600} step={5} slider />
  </div>

  {#if !op}
    <p class="mt-6 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
      A boost converter needs an input voltage below the output voltage. Above, the board uses the
      bypass.
    </p>
  {:else}
    <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Duty cycle" value={fmt(op.dutyCycle * 100)} unit="%" hint={`${op.mode === "CCM" ? "Continuous" : "Discontinuous"} conduction`} />
      <Stat label="Input current" value={fmt(op.inputCurrent)} unit="A" />
      <Stat label="Ripple (peak-to-peak)" value={fmt(op.ripple)} unit="A" />
      <Stat label="Peak current" value={fmt(op.peakCurrent)} unit="A" />
    </div>

    {#if op.outputCurrent > board.boostMaxOutputCurrent || op.inputCurrent > board.rectifierMaxCurrent}
      <p class="mt-4 rounded-md border px-3 py-2 text-sm">
        <strong>Above rating:</strong> The output current of {fmt(op.outputCurrent)} A or the input
        current of {fmt(op.inputCurrent)} A exceeds the limits of {board.boostMaxOutputCurrent} A
        (output) and {board.rectifierMaxCurrent} A (input), so the current has to be limited.
      </p>
    {/if}

    <LineChart
      title="Inductor current over three switching periods"
      {series}
      xLabel="Time (µs)"
      yLabel="Current (A)"
      xUnit="µs"
      yUnit="A"
      xMax={3e6 / conv.frequency}
      height={240}
    />
  {/if}
</div>
