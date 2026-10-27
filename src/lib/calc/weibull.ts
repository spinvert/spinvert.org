/**
 * Wind speed distribution and annual energy yield
 *
 * The wind speeds at a site are commonly described by a Weibull distribution with shape factor
 * k and scale factor c. With k = 2 (Rayleigh distribution), it is fully determined by the mean
 * wind speed, which is a good approximation for many inland sites.
 */

/** Gamma function (Lanczos approximation, valid for x > 0) */
export function gamma(x: number): number {
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * t ** (x + 0.5) * Math.exp(-t) * a;
}

/** Scale factor c [m/s] of a Weibull distribution with given mean wind speed and shape factor */
export function weibullScale(meanWindSpeed: number, shape: number): number {
  return meanWindSpeed / gamma(1 + 1 / shape);
}

/** Probability density of the wind speed v [1/(m/s)] */
export function weibullDensity(v: number, meanWindSpeed: number, shape: number): number {
  if (v < 0) return 0;
  const c = weibullScale(meanWindSpeed, shape);
  return (shape / c) * (v / c) ** (shape - 1) * Math.exp(-((v / c) ** shape));
}

export const HOURS_PER_YEAR = 8760;

/**
 * Annual energy [kWh] from a power curve given as [wind speed, power in W] points, sorted by
 * wind speed and starting at 0 m/s. Integrated with the trapezoidal rule, no output above the
 * last point.
 */
export function annualEnergy(
  powerCurve: [number, number][],
  meanWindSpeed: number,
  shape: number,
): number {
  let energy = 0;
  for (let i = 1; i < powerCurve.length; i++) {
    const [v0, p0] = powerCurve[i - 1];
    const [v1, p1] = powerCurve[i];
    const f0 = p0 * weibullDensity(v0, meanWindSpeed, shape);
    const f1 = p1 * weibullDensity(v1, meanWindSpeed, shape);
    energy += ((f0 + f1) / 2) * (v1 - v0);
  }
  return (energy * HOURS_PER_YEAR) / 1000;
}
