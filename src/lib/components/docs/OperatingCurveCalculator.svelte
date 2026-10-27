<script lang="ts">
  import { onMount } from "svelte";
  import { board } from "$lib/calc/board";
  import {
    angularSpeed,
    currentForShaftPower,
    openCircuitDcVoltage,
    rewindGenerator,
  } from "$lib/calc/generator";
  import {
    type Mode,
    type WindSystem,
    boostPowerLimit,
    controlPoint,
    lookupCurve,
    noBoostControlPoint,
    noBoostSteadyState,
    steadyState,
  } from "$lib/calc/operating";
  import {
    maxRotorPower,
    optimalCurveConstant,
    optimalCurvePower,
    optimalRpm,
    rotorPower,
    runawayTsr,
  } from "$lib/calc/wind";
  import { HOURS_PER_YEAR, annualEnergy, weibullDensity } from "$lib/calc/weibull";
  import { type Band, type Series, fmt } from "./chart";
  import LineChart from "./LineChart.svelte";
  import NumberField from "./NumberField.svelte";
  import Stat from "./Stat.svelte";

  const defaults = {
    diameter: 2,
    cpMax: 0.38,
    tsrOpt: 6,
    airDensity: 1.225,
    poles: 16,
    ke: 70,
    resistance: 0.2,
    inductance: 0.8,
    batteryVoltage: 48,
    boostEfficiency: 95,
    curvePoints: 16,
    meanWindSpeed: 4.5,
    weibullShape: 2,
  };

  // Rough annual mean wind speeds at the hub height of small wind turbines (10 to 20 m)
  const sitePresets = [
    { label: "Sheltered inland", meanWindSpeed: 3.5 },
    { label: "Open inland", meanWindSpeed: 4.5 },
    { label: "Coastal", meanWindSpeed: 5.5 },
    { label: "Exposed coast or hilltop", meanWindSpeed: 7 },
  ];

  let diameter = $state(defaults.diameter);
  let cpMax = $state(defaults.cpMax);
  let tsrOpt = $state(defaults.tsrOpt);
  let airDensity = $state(defaults.airDensity);
  let poles = $state(defaults.poles);
  let ke = $state(defaults.ke);
  let resistance = $state(defaults.resistance);
  let inductance = $state(defaults.inductance);
  let batteryVoltage = $state(defaults.batteryVoltage);
  let boostEfficiency = $state(defaults.boostEfficiency);
  let curvePoints = $state(defaults.curvePoints);
  let meanWindSpeed = $state(defaults.meanWindSpeed);
  let weibullShape = $state(defaults.weibullShape);

  function reset() {
    ({ diameter, cpMax, tsrOpt, airDensity, poles, ke, resistance, inductance } = defaults);
    ({ batteryVoltage, boostEfficiency, curvePoints, meanWindSpeed, weibullShape } = defaults);
  }

  // Generator parameters can be passed from the characterization tool via URL parameters
  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const read = (key: string) => {
      const value = Number(params.get(key));
      return params.has(key) && Number.isFinite(value) && value > 0 ? value : undefined;
    };
    poles = read("poles") ?? poles;
    ke = read("ke") ?? ke;
    resistance = read("r") ?? resistance;
    inductance = read("l") ?? inductance;
  });

  const valid = $derived(
    [diameter, cpMax, tsrOpt, airDensity, poles, ke, resistance, inductance, batteryVoltage]
      .concat([boostEfficiency, curvePoints])
      .every((v) => typeof v === "number" && Number.isFinite(v) && v > 0) &&
      cpMax < 0.593 &&
      boostEfficiency <= 100 &&
      batteryVoltage < board.maxInputVoltage &&
      curvePoints >= 2,
  );

  const sys: WindSystem = $derived({
    turbine: { radius: diameter / 2, cpMax, tsrOpt, airDensity },
    generator: {
      poles,
      ke,
      phaseResistance: resistance,
      phaseInductance: inductance / 1000,
    },
    rectifier: { diodeForwardVoltage: 0.8, mosfetResistance: 0.005 },
    batteryVoltage,
    boostEfficiency: boostEfficiency / 100,
  });

  const modeLabels: Record<Mode, string> = {
    boost: "Boost",
    "boost-limited": "Boost (limited)",
    bypass: "Bypass",
    overload: "Overload",
  };

  const familySpeeds = [4, 6, 8, 10, 12, 14];
  const maxWind = 20;

  const rpmMax = $derived(valid ? optimalRpm(sys.turbine, 14) * 1.25 : 1);
  const rpmGrid = $derived(Array.from({ length: 161 }, (_, i) => (rpmMax * i) / 160));
  const controlGrid = $derived(valid ? rpmGrid.map((rpm) => controlPoint(sys, rpm)) : []);
  const states = $derived(
    valid ? Array.from({ length: maxWind * 2 }, (_, i) => steadyState(sys, (i + 1) / 2)) : [],
  );
  const curve = $derived(valid ? lookupCurve(sys, Math.min(Math.round(curvePoints), 64)) : []);

  // Chart 1: rotor power curves and load curves over speed
  const powerSeries: Series[] = $derived(
    valid
      ? [
          ...familySpeeds.map((v) => ({
            id: `wind-${v}`,
            label: `Rotor at ${v} m/s`,
            color: "var(--viz-context)",
            legend: false,
            peakLabel: `${v} m/s`,
            points: rpmGrid.map((rpm): [number, number] => [rpm, rotorPower(sys.turbine, v, rpm)]),
          })),
          {
            id: "optimal",
            label: "Optimal curve k·ω³",
            color: "var(--viz-2)",
            dashed: true,
            points: rpmGrid.map((rpm): [number, number] => [rpm, optimalCurvePower(sys.turbine, rpm)]),
          },
          {
            id: "board",
            label: "Load with Spinvert",
            color: "var(--viz-1)",
            points: controlGrid.map((p): [number, number] => [p.rpm, p.shaftPower]),
          },
          {
            id: "no-boost",
            label: "Load without boost stage",
            color: "var(--viz-3)",
            points: rpmGrid.map((rpm): [number, number] => [rpm, noBoostControlPoint(sys, rpm).shaftPower]),
          },
        ]
      : [],
  );

  const powerMarkers = $derived(
    familySpeeds.flatMap((v) => {
      const state = states.find((s) => s.windSpeed === v);
      return state ? [{ x: state.board.rpm, y: state.board.shaftPower, color: "var(--viz-1)" }] : [];
    }),
  );

  // Regions of the operating modes along the speed axis
  const modeBands: Band[] = $derived(
    controlGrid.reduce<Band[]>((bands, p) => {
      const label = modeLabels[p.mode];
      const last = bands.at(-1);
      if (last && last.label === label) last.to = p.rpm;
      else bands.push({ from: last ? last.to : 0, to: p.rpm, label });
      return bands;
    }, []),
  );

  // Chart 2: lookup curve
  const curveSeries: Series[] = $derived([
    {
      id: "curve",
      label: "Target boost input current",
      color: "var(--viz-1)",
      markers: true,
      points: curve.map((p): [number, number] => [p.frequency, p.current]),
    },
  ]);

  // Chart 3: output power over wind speed
  const boardPowerCurve = $derived(
    [[0, 0] as [number, number]].concat(
      states.map((s): [number, number] => [s.windSpeed, s.board.outputPower]),
    ),
  );
  const noBoostPowerCurve = $derived(
    [[0, 0] as [number, number]].concat(
      states.map((s): [number, number] => [s.windSpeed, s.noBoost.outputPower]),
    ),
  );

  const yieldSeries: Series[] = $derived(
    valid
      ? [
          {
            id: "ideal",
            label: "Rotor power at C_p,max",
            color: "var(--viz-2)",
            dashed: true,
            points: [[0, 0] as [number, number]].concat(
              states.map((s): [number, number] => [s.windSpeed, s.idealPower]),
            ),
          },
          {
            id: "board",
            label: "Output with Spinvert",
            color: "var(--viz-1)",
            points: boardPowerCurve,
          },
          {
            id: "no-boost",
            label: "Output without boost stage",
            color: "var(--viz-3)",
            points: noBoostPowerCurve,
          },
        ]
      : [],
  );

  // Energy yield weighted with the wind speed distribution of the site
  const siteValid = $derived(
    typeof meanWindSpeed === "number" &&
      meanWindSpeed > 0 &&
      typeof weibullShape === "number" &&
      weibullShape >= 1 &&
      weibullShape <= 4,
  );

  const energyBoard = $derived(
    siteValid ? annualEnergy(boardPowerCurve, meanWindSpeed, weibullShape) : 0,
  );
  const energyNoBoost = $derived(
    siteValid ? annualEnergy(noBoostPowerCurve, meanWindSpeed, weibullShape) : 0,
  );

  // A system without boost stage would use a generator with a higher voltage constant. For a
  // fair comparison, find the best rewound version of the generator for this case.
  const rewound = $derived.by(() => {
    if (!valid || !siteValid) return undefined;
    let best = { ke: ke, energy: 0, curve: noBoostPowerCurve };
    for (let factor = 0.8; factor <= 3.001; factor += 0.05) {
      const rewoundSys = { ...sys, generator: rewindGenerator(sys.generator, ke * factor) };
      const curve = [[0, 0] as [number, number]].concat(
        states.map((s): [number, number] => [
          s.windSpeed,
          noBoostSteadyState(rewoundSys, s.windSpeed).outputPower,
        ]),
      );
      const energy = annualEnergy(curve, meanWindSpeed, weibullShape);
      if (energy > best.energy) best = { ke: ke * factor, energy, curve };
    }
    return best;
  });

  const gain = (energy: number, reference: number) =>
    reference > 0 ? `+${Math.round((energy / reference - 1) * 100)} % with Spinvert` : "";

  // Annual energy per wind speed interval [kWh/(m/s)]
  const energyDensity = (curve: [number, number][]) =>
    curve.map(([v, p]): [number, number] => [
      v,
      (p * weibullDensity(v, meanWindSpeed, weibullShape) * HOURS_PER_YEAR) / 1000,
    ]);

  const energySeries: Series[] = $derived(
    valid && siteValid && rewound
      ? [
          {
            id: "board",
            label: "Spinvert",
            color: "var(--viz-1)",
            points: energyDensity(boardPowerCurve),
          },
          {
            id: "no-boost",
            label: "Without boost stage",
            color: "var(--viz-3)",
            points: energyDensity(noBoostPowerCurve),
          },
          {
            id: "no-boost-rewound",
            label: "Without boost stage, rewound generator",
            color: "var(--viz-3)",
            dashed: true,
            points: energyDensity(rewound.curve),
          },
        ]
      : [],
  );

  const firstWind = (predicate: (mode: Mode) => boolean) =>
    states.find((s) => predicate(s.board.mode))?.windSpeed;
  const bypassWind = $derived(firstWind((m) => m === "bypass" || m === "overload"));
  const limitWind = $derived(firstWind((m) => m !== "boost"));
  const overloadWind = $derived(firstWind((m) => m === "overload"));

  // Speed at which the open-circuit voltage reaches the input voltage rating, and the wind
  // speed at which the unloaded rotor reaches this speed
  const rpmAtMaxVoltage = $derived(
    valid ? (board.maxInputVoltage / openCircuitDcVoltage(sys.generator, 1000)) * 1000 : 0,
  );
  const windAtMaxVoltage = $derived(
    valid ? (angularSpeed(rpmAtMaxVoltage) * sys.turbine.radius) / runawayTsr(sys.turbine) : 0,
  );

  // Speed above which the generator can't deliver the optimal power due to its inductance
  const inductanceLimitRpm = $derived(
    valid
      ? rpmGrid.find(
          (rpm) =>
            currentForShaftPower(sys.generator, rpm, optimalCurvePower(sys.turbine, rpm)) ===
            undefined,
        )
      : undefined,
  );

  const tableSpeeds = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16];
  const tableStates = $derived(states.filter((s) => tableSpeeds.includes(s.windSpeed)));

  function download(name: string, type: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    const rows = curve.map((p) =>
      [p.frequency, p.rpm, p.current, p.voltage, p.power].map((v) => v.toFixed(3)).join(","),
    );
    download(
      "spinvert-curve.csv",
      "text/csv",
      ["frequency_hz,rpm,current_a,voltage_v,power_w", ...rows].join("\n") + "\n",
    );
  }

  function downloadJson() {
    const data = {
      poles,
      frequency: curve.map((p) => Number(p.frequency.toFixed(2))),
      current: curve.map((p) => Number(p.current.toFixed(3))),
    };
    download("spinvert-curve.json", "application/json", JSON.stringify(data, null, 2) + "\n");
  }
</script>

<div class="not-prose my-8 rounded-lg border p-4 sm:p-6">
  <div class="grid gap-6 sm:grid-cols-3">
    <fieldset class="space-y-3">
      <legend class="mb-3 text-sm font-medium">Rotor</legend>
      <NumberField label="Rotor diameter" bind:value={diameter} unit="m" min={0.5} max={6} step={0.1} />
      <NumberField label="Max. power coefficient C_p,max" bind:value={cpMax} min={0.1} max={0.59} step={0.01} />
      <NumberField label="Optimal tip speed ratio λ_opt" bind:value={tsrOpt} min={1} max={12} step={0.1} />
      <NumberField label="Air density ρ" bind:value={airDensity} unit="kg/m³" min={0.9} max={1.4} step={0.005} />
    </fieldset>
    <fieldset class="space-y-3">
      <legend class="mb-3 text-sm font-medium">Generator</legend>
      <NumberField label="Number of poles" bind:value={poles} min={2} max={80} step={2} />
      <NumberField
        label="Voltage constant k_e (line-to-line RMS)"
        bind:value={ke}
        unit="V/krpm"
        min={1}
        max={500}
        step={1}
      />
      <NumberField label="Phase resistance" bind:value={resistance} unit="Ω" min={0.001} max={10} step={0.01} />
      <NumberField label="Phase inductance" bind:value={inductance} unit="mH" min={0} max={50} step={0.1} />
    </fieldset>
    <fieldset class="space-y-3">
      <legend class="mb-3 text-sm font-medium">System</legend>
      <NumberField label="Battery voltage" bind:value={batteryVoltage} unit="V" min={36} max={58} step={0.5} />
      <NumberField label="Boost efficiency" bind:value={boostEfficiency} unit="%" min={50} max={100} step={1} />
      <NumberField label="Points of lookup curve" bind:value={curvePoints} min={2} max={64} step={1} />
      <button
        type="button"
        onclick={reset}
        class="mt-2 h-8 rounded-md border px-3 text-sm hover:bg-accent hover:text-accent-foreground"
      >
        Reset to example
      </button>
    </fieldset>
  </div>

  {#if !valid}
    <p class="mt-6 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
      Please enter positive values. C_p,max must be below the Betz limit of 0.593 and the battery
      voltage below the input voltage rating of {board.maxInputVoltage} V.
    </p>
  {:else}
    <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        label="Optimal curve constant k_opt"
        value={fmt(optimalCurveConstant(sys.turbine) * 1000)}
        unit="mW·s³"
      />
      <Stat
        label="Boost power limit reached"
        value={limitWind ? fmt(limitWind) : "–"}
        unit="m/s"
        hint={`${fmt(boostPowerLimit(sys))} W input`}
      />
      <Stat label="Bypass from" value={bypassWind ? fmt(bypassWind) : "–"} unit="m/s" />
      <Stat
        label="20 A rating exceeded"
        value={overloadWind ? fmt(overloadWind) : `> ${maxWind}`}
        unit="m/s"
      />
    </div>

    <ul class="mt-4 space-y-2 text-sm">
      <li class="rounded-md border px-3 py-2">
        <strong>Input voltage:</strong> Without load, the rectified voltage exceeds
        {board.maxInputVoltage} V above {fmt(rpmAtMaxVoltage)} rpm. The unloaded rotor reaches this
        speed at wind speeds above {fmt(windAtMaxVoltage)} m/s, so the turbine must never be left
        without load (see dump load).
      </li>
      {#if inductanceLimitRpm !== undefined}
        <li class="rounded-md border px-3 py-2">
          <strong>Generator inductance:</strong> Above {fmt(inductanceLimitRpm)} rpm, the generator
          cannot deliver the optimal power because of the voltage drop across its inductance.
        </li>
      {/if}
    </ul>

    <LineChart
      title="Rotor power and generator load over speed"
      series={powerSeries}
      bands={modeBands}
      markers={powerMarkers}
      xLabel="Rotor speed (rpm)"
      yLabel="Power (W)"
      xUnit="rpm"
      yUnit="W"
      xMax={rpmMax}
      yMax={maxRotorPower(sys.turbine, 14) * 1.1}
    />
    <p class="text-xs text-muted-foreground">
      Gray: rotor power at different wind speeds. Dots: steady-state operating points with the
      Spinvert Boost, where the rotor power equals the power drawn by the generator.
    </p>

    <LineChart
      title="Output power over wind speed"
      series={yieldSeries}
      xLabel="Wind speed (m/s)"
      yLabel="Power (W)"
      xUnit="m/s"
      yUnit="W"
      xMax={16}
      yMax={Math.max(...states.filter((s) => s.windSpeed <= 16).map((s) => s.board.outputPower)) * 1.6}
    />

    <details class="mt-2 text-sm">
      <summary class="cursor-pointer font-medium">Operating points as table</summary>
      <div class="mt-2 overflow-x-auto">
        <table class="w-full text-right tabular-nums">
          <thead class="text-xs text-muted-foreground">
            <tr class="border-b">
              <th class="py-1 pr-3 font-normal">Wind (m/s)</th>
              <th class="py-1 pr-3 font-normal">Speed (rpm)</th>
              <th class="py-1 pr-3 text-left font-normal">Mode</th>
              <th class="py-1 pr-3 font-normal">Rectified (V)</th>
              <th class="py-1 pr-3 font-normal">Current (A)</th>
              <th class="py-1 pr-3 font-normal">Output (W)</th>
              <th class="py-1 font-normal">Without boost (W)</th>
            </tr>
          </thead>
          <tbody>
            {#each tableStates as s (s.windSpeed)}
              <tr class="border-b last:border-0">
                <td class="py-1 pr-3">{s.windSpeed}</td>
                <td class="py-1 pr-3">{fmt(s.board.rpm)}</td>
                <td class="py-1 pr-3 text-left">{modeLabels[s.board.mode]}</td>
                <td class="py-1 pr-3">{fmt(s.board.voltage)}</td>
                <td class="py-1 pr-3">{fmt(s.board.current)}</td>
                <td class="py-1 pr-3">{fmt(s.board.outputPower)}</td>
                <td class="py-1">{fmt(s.noBoost.outputPower)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>

    <h3 class="mt-8 text-sm font-medium">Annual energy yield</h3>
    <p class="mt-1 text-xs text-muted-foreground">
      The output power is weighted with a Weibull distribution of the wind speed at the site.
    </p>
    <div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Site presets">
      {#each sitePresets as preset (preset.label)}
        <button
          type="button"
          aria-pressed={meanWindSpeed === preset.meanWindSpeed}
          onclick={() => (meanWindSpeed = preset.meanWindSpeed)}
          class="h-8 rounded-md border px-3 text-sm hover:bg-accent hover:text-accent-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground"
        >
          {preset.label} ({preset.meanWindSpeed} m/s)
        </button>
      {/each}
    </div>
    <div class="mt-3 grid gap-6 sm:grid-cols-3">
      <NumberField
        label="Annual mean wind speed at hub height"
        bind:value={meanWindSpeed}
        unit="m/s"
        min={1}
        max={12}
        step={0.1}
      />
      <NumberField
        label="Weibull shape factor k"
        bind:value={weibullShape}
        min={1}
        max={4}
        step={0.1}
        hint="2 (Rayleigh) if unknown"
      />
    </div>

    {#if siteValid && rewound}
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="With Spinvert" value={fmt(energyBoard)} unit="kWh/year" />
        <Stat
          label="Without boost stage, same generator"
          value={fmt(energyNoBoost)}
          unit="kWh/year"
          hint={gain(energyBoard, energyNoBoost)}
        />
        <Stat
          label={`Without boost stage, rewound generator (k_e = ${fmt(rewound.ke)} V/krpm)`}
          value={fmt(rewound.energy)}
          unit="kWh/year"
          hint={gain(energyBoard, rewound.energy)}
        />
      </div>

      <LineChart
        title="Annual energy per wind speed"
        series={energySeries}
        xLabel="Wind speed (m/s)"
        yLabel="Energy (kWh per m/s)"
        xUnit="m/s"
        yUnit="kWh/(m/s)"
        xMax={16}
        height={260}
      />
      <p class="text-xs text-muted-foreground">
        The area below each curve is the annual energy. The rewound generator has the same magnets
        and copper volume, but the voltage constant giving the highest yield without boost stage.
      </p>
    {:else}
      <p class="mt-4 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
        Please enter a positive mean wind speed and a shape factor between 1 and 4.
      </p>
    {/if}

    <LineChart
      title="Lookup curve for the firmware: boost input current over generator frequency"
      series={curveSeries}
      xLabel="Electrical frequency (Hz)"
      yLabel="Current (A)"
      xUnit="Hz"
      yUnit="A"
    />
    <p class="text-xs text-muted-foreground">
      The curve ends at {fmt(curve.at(-1)?.frequency ?? 0)} Hz ({fmt(curve.at(-1)?.rpm ?? 0)} rpm),
      where the rectified voltage reaches the battery voltage and the board switches to bypass.
      Where the boost power limit applies, the current decreases again towards higher voltages to
      keep the power constant. Electrical frequency = poles × rpm / 120.
    </p>

    <details class="mt-4 text-sm">
      <summary class="cursor-pointer font-medium">Lookup curve as table</summary>
      <div class="mt-2 overflow-x-auto">
        <table class="w-full text-right tabular-nums">
          <thead class="text-xs text-muted-foreground">
            <tr class="border-b">
              <th class="py-1 pr-3 font-normal">Frequency (Hz)</th>
              <th class="py-1 pr-3 font-normal">Speed (rpm)</th>
              <th class="py-1 pr-3 font-normal">Current (A)</th>
              <th class="py-1 pr-3 font-normal">Voltage (V)</th>
              <th class="py-1 font-normal">Power (W)</th>
            </tr>
          </thead>
          <tbody>
            {#each curve as p, i (i)}
              <tr class="border-b last:border-0">
                <td class="py-1 pr-3">{fmt(p.frequency)}</td>
                <td class="py-1 pr-3">{fmt(p.rpm)}</td>
                <td class="py-1 pr-3">{fmt(p.current)}</td>
                <td class="py-1 pr-3">{fmt(p.voltage)}</td>
                <td class="py-1">{fmt(p.power)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>

    <div class="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onclick={downloadCsv}
        class="h-8 rounded-md border px-3 text-sm hover:bg-accent hover:text-accent-foreground"
      >
        Download CSV
      </button>
      <button
        type="button"
        onclick={downloadJson}
        class="h-8 rounded-md border px-3 text-sm hover:bg-accent hover:text-accent-foreground"
      >
        Download JSON
      </button>
    </div>
  {/if}
</div>
