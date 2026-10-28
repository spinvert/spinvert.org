<script lang="ts">
  import { board } from "$lib/calc/board";
  import { RECTIFIER_FACTOR, characterizeGenerator } from "$lib/calc/generator";
  import { fmt } from "./chart";
  import NumberField from "./NumberField.svelte";
  import Stat from "./Stat.svelte";

  interface Props {
    /** Page with the operating curve calculator */
    calculatorHref: string;
  }

  let { calculatorHref }: Props = $props();

  let rpm = $state(600);
  let lineVoltage = $state(42);
  let frequency = $state(79);
  let lineResistance = $state(0.4);
  let lineInductance = $state(1.6);

  const valid = $derived(
    [rpm, lineVoltage, frequency, lineResistance, lineInductance].every(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= 0,
    ) &&
      rpm > 0 &&
      lineVoltage > 0,
  );

  const result = $derived(
    valid
      ? characterizeGenerator({
          rpm,
          lineVoltage,
          frequency,
          lineResistance,
          lineInductance: lineInductance / 1000,
        })
      : undefined,
  );

  // Speed at which the rectified open-circuit voltage reaches a given value
  const rpmAt = (voltage: number) =>
    result ? (voltage / (RECTIFIER_FACTOR * result.generator.ke)) * 1000 : 0;

  const polesMismatch = $derived(
    result ? Math.abs(result.polesExact - result.generator.poles) > 0.3 : false,
  );

  const href = $derived.by(() => {
    if (!result) return calculatorHref;
    const g = result.generator;
    const params = new URLSearchParams({
      poles: String(g.poles),
      ke: g.ke.toFixed(2),
      r: g.phaseResistance.toFixed(4),
      l: (g.phaseInductance * 1000).toFixed(3),
    });
    return `${calculatorHref}?${params}#calculator`;
  });
</script>

<div class="not-prose my-8 rounded-lg border p-4 sm:p-6">
  <div class="grid gap-6 sm:grid-cols-2">
    <fieldset class="space-y-3">
      <legend class="mb-3 text-sm font-medium">Open-circuit test (generator driven, no load)</legend>
      <NumberField label="Speed" bind:value={rpm} unit="rpm" min={1} step={10} />
      <NumberField
        label="Voltage between two terminals (AC, RMS)"
        bind:value={lineVoltage}
        unit="V"
        min={0}
        step={0.1}
      />
      <NumberField label="Frequency of that voltage" bind:value={frequency} unit="Hz" min={0} step={0.1} />
    </fieldset>
    <fieldset class="space-y-3">
      <legend class="mb-3 text-sm font-medium">Resistance and inductance (generator at rest)</legend>
      <NumberField
        label="Resistance between two terminals"
        bind:value={lineResistance}
        unit="Ω"
        min={0}
        step={0.01}
        hint="Use a 4-wire measurement or a known DC current for small values."
      />
      <NumberField
        label="Inductance between two terminals"
        bind:value={lineInductance}
        unit="mH"
        min={0}
        step={0.1}
        hint="Optional. Measure with an LCR meter, ideally at the electrical frequency."
      />
    </fieldset>
  </div>

  {#if result}
    <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        label="Number of poles"
        value={String(result.generator.poles)}
        hint={`calculated: ${fmt(result.polesExact)}`}
      />
      <Stat label="Voltage constant k_e" value={fmt(result.generator.ke)} unit="V/krpm" />
      <Stat label="Phase resistance" value={fmt(result.generator.phaseResistance)} unit="Ω" />
      <Stat label="Phase inductance" value={fmt(result.generator.phaseInductance * 1000)} unit="mH" />
    </div>

    {#if polesMismatch}
      <p class="mt-4 rounded-md border px-3 py-2 text-sm">
        The calculated pole count is not close to an even number. Check the speed and frequency
        measurement.
      </p>
    {/if}

    <p class="mt-4 text-sm">
      The rectified open-circuit voltage reaches {board.outputVoltage} V (battery voltage) at
      <strong>{fmt(rpmAt(board.outputVoltage))} rpm</strong> and {board.maxInputVoltage} V (input
      voltage rating of the Spinvert Boost) at
      <strong>{fmt(rpmAt(board.maxInputVoltage))} rpm</strong>.
    </p>

    <a
      {href}
      class="mt-4 inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
    >
      Use in operating curve calculator
    </a>
  {/if}
</div>
