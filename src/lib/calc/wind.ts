import { angularSpeed, rpmFromAngularSpeed } from "./generator";

/**
 * Model of a wind turbine rotor with fixed blade pitch.
 */
export interface Turbine {
  /** Rotor radius [m] */
  radius: number;
  /** Maximum power coefficient C_p,max (Betz limit: 0.593) */
  cpMax: number;
  /** Tip speed ratio at C_p,max */
  tsrOpt: number;
  /** Air density [kg/m³] */
  airDensity: number;
}

// Generic C_p(λ) curve from Heier (blade pitch angle β = 0). It is only used for the shape
// of the curve and scaled to the C_p,max and λ_opt of the actual turbine.
function heierCp(tsr: number): number {
  if (tsr <= 0) return 0;
  const inv = 1 / tsr - 0.035;
  return 0.5176 * (116 * inv - 5) * Math.exp(-21 * inv) + 0.0068 * tsr;
}

// Location of the maximum of the generic curve, found numerically
const heierPeak = (() => {
  let best = { tsr: 0, cp: 0 };
  for (let tsr = 1; tsr <= 15; tsr += 0.0005) {
    const cp = heierCp(tsr);
    if (cp > best.cp) best = { tsr, cp };
  }
  return best;
})();

/** Power coefficient for a given tip speed ratio (negative values beyond runaway) */
export function powerCoefficient(turbine: Turbine, tsr: number): number {
  return (turbine.cpMax / heierPeak.cp) * heierCp((tsr * heierPeak.tsr) / turbine.tsrOpt);
}

/** Tip speed ratio at which the rotor is no longer driven (C_p = 0) */
export function runawayTsr(turbine: Turbine): number {
  // Bisection on the falling edge of the curve
  let low = turbine.tsrOpt;
  let high = 4 * turbine.tsrOpt;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (powerCoefficient(turbine, mid) > 0) low = mid;
    else high = mid;
  }
  return low;
}

export function sweptArea(turbine: Turbine): number {
  return Math.PI * turbine.radius ** 2;
}

/** Tip speed ratio λ = ω·R / v */
export function tipSpeedRatio(turbine: Turbine, windSpeed: number, rpm: number): number {
  return (angularSpeed(rpm) * turbine.radius) / windSpeed;
}

/** Mechanical power at the rotor shaft [W], zero above runaway speed */
export function rotorPower(turbine: Turbine, windSpeed: number, rpm: number): number {
  if (windSpeed <= 0) return 0;
  const cp = powerCoefficient(turbine, tipSpeedRatio(turbine, windSpeed, rpm));
  return Math.max(0, 0.5 * turbine.airDensity * sweptArea(turbine) * cp * windSpeed ** 3);
}

/** Maximum power that can be extracted from the wind [W] */
export function maxRotorPower(turbine: Turbine, windSpeed: number): number {
  return 0.5 * turbine.airDensity * sweptArea(turbine) * turbine.cpMax * windSpeed ** 3;
}

/** Rotor speed at which the maximum power is extracted [rpm] */
export function optimalRpm(turbine: Turbine, windSpeed: number): number {
  return rpmFromAngularSpeed((turbine.tsrOpt * windSpeed) / turbine.radius);
}

/** Rotor speed without load [rpm] */
export function runawayRpm(turbine: Turbine, windSpeed: number): number {
  return rpmFromAngularSpeed((runawayTsr(turbine) * windSpeed) / turbine.radius);
}

/**
 * Constant k_opt of the optimal power curve P = k_opt·ω³ [W·s³]
 *
 * Operating the rotor on this curve keeps the tip speed ratio at λ_opt for any wind speed,
 * without having to measure the wind speed.
 */
export function optimalCurveConstant(turbine: Turbine): number {
  return (
    (0.5 * turbine.airDensity * Math.PI * turbine.radius ** 5 * turbine.cpMax) / turbine.tsrOpt ** 3
  );
}

/** Shaft power on the optimal curve at a given speed [W] */
export function optimalCurvePower(turbine: Turbine, rpm: number): number {
  return optimalCurveConstant(turbine) * angularSpeed(rpm) ** 3;
}
