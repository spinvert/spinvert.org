<script lang="ts">
  type Path = "generator" | "boost" | "bypass" | "dump";
  type Block = "generator" | "rectifier" | "boost" | "bypass" | "dump" | "output";

  interface ModeInfo {
    label: string;
    description: string;
    paths: Path[];
  }

  const modes: Record<string, ModeInfo> = {
    standby: {
      label: "Standby",
      description:
        "No or very little wind. The generator is not loaded, so that the rotor can start up. The board measures the generator voltage and frequency to detect when power can be harvested.",
      paths: [],
    },
    boost: {
      label: "Low wind: boost",
      description:
        "The rectified generator voltage is below the battery voltage. The boost converter draws the current given by the lookup curve from the generator and steps up the voltage to charge the battery.",
      paths: ["generator", "boost"],
    },
    bypass: {
      label: "High wind: bypass",
      description:
        "The rectified voltage reaches the battery voltage, so boosting is not needed anymore. The rectifier is connected directly to the output, allowing up to 20 A.",
      paths: ["generator", "bypass"],
    },
    dump: {
      label: "Battery full / overspeed: dump load",
      description:
        "The battery can't take more energy or the rotor is too fast. The dump load keeps the generator loaded, so that the rotor doesn't run away and the voltage stays within limits.",
      paths: ["generator", "dump"],
    },
  };

  let mode = $state<keyof typeof modes>("boost");
  const active = $derived(new Set(modes[mode].paths));

  const blockActive = (block: Block) => {
    switch (block) {
      case "generator":
      case "rectifier":
        return active.has("generator");
      case "output":
        return active.has("boost") || active.has("bypass");
      default:
        return active.has(block);
    }
  };

  const blocks: { id: Block; x: number; y: number; w: number; h: number; label: string; sub?: string }[] = [
    { id: "rectifier", x: 150, y: 100, w: 120, h: 60, label: "Active", sub: "rectifier" },
    { id: "boost", x: 380, y: 20, w: 130, h: 56, label: "DC/DC boost", sub: "10 A @ 48 V" },
    { id: "bypass", x: 380, y: 102, w: 130, h: 56, label: "Bypass", sub: "20 A" },
    { id: "dump", x: 380, y: 184, w: 130, h: 56, label: "Dump load", sub: "20 A" },
    { id: "output", x: 590, y: 100, w: 110, h: 60, label: "Battery", sub: "48 V" },
  ];

  // Wires as SVG paths, each belonging to a power path
  const wires: { path: Path; d: string }[] = [
    { path: "generator", d: "M100,115 H150" },
    { path: "generator", d: "M100,130 H150" },
    { path: "generator", d: "M100,145 H150" },
    { path: "generator", d: "M270,130 H320" },
    { path: "boost", d: "M320,130 V48 H380" },
    { path: "boost", d: "M510,48 H550 V120 H590" },
    { path: "bypass", d: "M320,130 H380" },
    { path: "bypass", d: "M510,130 H590" },
    { path: "dump", d: "M320,130 V212 H380" },
  ];
</script>

<div class="not-prose my-8 rounded-lg border p-4 sm:p-6">
  <div class="flex flex-wrap gap-2" role="group" aria-label="Operating mode">
    {#each Object.entries(modes) as [key, info] (key)}
      <button
        type="button"
        aria-pressed={mode === key}
        onclick={() => (mode = key)}
        class="h-8 rounded-md border px-3 text-sm hover:bg-accent hover:text-accent-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:font-medium aria-pressed:text-accent-foreground"
      >
        {info.label}
      </button>
    {/each}
  </div>

  <svg viewBox="0 0 720 260" class="mt-4 w-full" role="img" aria-label={`Power flow: ${modes[mode].label}`}>
    {#each wires as wire, i (i)}
      <path
        d={wire.d}
        fill="none"
        class={active.has(wire.path) ? "flow stroke-primary" : "stroke-border"}
        stroke-width={active.has(wire.path) ? 3 : 2}
      />
    {/each}
    <circle cx="320" cy="130" r="4" class={active.has("generator") ? "fill-primary" : "fill-border"} />

    <!-- Generator symbol -->
    <circle
      cx="55"
      cy="130"
      r="40"
      class={blockActive("generator") ? "fill-accent stroke-primary" : "fill-background stroke-border"}
      stroke-width="2"
    />
    <text x="55" y="126" text-anchor="middle" class="fill-foreground text-[17px] font-semibold">G</text>
    <text x="55" y="146" text-anchor="middle" class="fill-muted-foreground text-[13px]">3~</text>

    {#each blocks as b (b.id)}
      <rect
        x={b.x}
        y={b.y}
        width={b.w}
        height={b.h}
        rx="8"
        class={blockActive(b.id) ? "fill-accent stroke-primary" : "fill-background stroke-border"}
        stroke-width="2"
      />
      <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 3} text-anchor="middle" class="fill-foreground text-[15px] font-medium">
        {b.label}
      </text>
      {#if b.sub}
        <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 14} text-anchor="middle" class="fill-muted-foreground text-[13px]">
          {b.sub}
        </text>
      {/if}
    {/each}
  </svg>

  <p class="mt-2 text-sm" aria-live="polite">{modes[mode].description}</p>
</div>

<style>
  .flow {
    stroke-dasharray: 8 6;
    animation: flow 0.8s linear infinite;
  }

  @keyframes flow {
    to {
      stroke-dashoffset: -14;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .flow {
      animation: none;
      stroke-dasharray: none;
    }
  }
</style>
