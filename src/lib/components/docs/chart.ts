export interface Series {
  id: string;
  label: string;
  /** CSS color, e.g. `var(--viz-1)` */
  color: string;
  points: [number, number][];
  dashed?: boolean;
  /** Show the series in legend and tooltip (default: true) */
  legend?: boolean;
  /** Direct label shown at the highest point of the series */
  peakLabel?: string;
  /** Draw a marker on every point */
  markers?: boolean;
}

export interface Band {
  from: number;
  to: number;
  label: string;
}

export interface Marker {
  x: number;
  y: number;
  color: string;
}

/** Rounds up to a "nice" number for axis steps: 1, 2, 2.5 or 5 times a power of ten */
function niceStep(range: number, count: number): number {
  const raw = range / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

/** Axis ticks between min and max, with max rounded up to the next tick */
export function ticks(min: number, max: number, count = 5): { values: number[]; max: number } {
  if (!(max > min)) max = min + 1;
  const step = niceStep(max - min, count);
  const start = Math.ceil(min / step) * step;
  const end = Math.ceil(max / step - 1e-9) * step;
  const values: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) values.push(Number(v.toPrecision(12)));
  return { values, max: end };
}

/** Linear interpolation of y at x, undefined outside of the series */
export function interpolate(points: [number, number][], x: number): number | undefined {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x >= Math.min(x0, x1) && x <= Math.max(x0, x1)) {
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return undefined;
}

/** Formats a number with a sensible number of digits for display */
export function fmt(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  if (abs >= 10 ** digits) return Math.round(value).toLocaleString("en-US");
  if (abs === 0) return "0";
  const decimals = Math.max(0, digits - 1 - Math.floor(Math.log10(abs)));
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals });
}
