import { board } from "./board";
import {
  type Generator,
  type Rectifier,
  currentAtClampedVoltage,
  currentForShaftPower,
  dcOperatingPoint,
  electricalFrequency,
  openCircuitDcVoltage,
  commutationResistance,
} from "./generator";
import { type Turbine, maxRotorPower, optimalCurvePower, rotorPower, runawayRpm } from "./wind";

export interface WindSystem {
  turbine: Turbine;
  generator: Generator;
  rectifier: Rectifier;
  /** Battery or DC bus voltage at the output [V] */
  batteryVoltage: number;
  /** Efficiency of the boost stage */
  boostEfficiency: number;
}

/**
 * Operating mode of the board
 *
 * - `boost`: The boost converter controls the generator current along the optimal curve.
 * - `boost-limited`: As `boost`, but the current is reduced to stay within the ratings of the
 *   boost stage. The rotor speeds up beyond its optimal speed.
 * - `bypass`: The rectified voltage exceeds the battery voltage and the rectifier is connected
 *   directly to the output. The battery voltage determines the generator current.
 * - `overload`: Bypass current above its rating. The turbine has to be slowed down by other
 *   means (dump load in combination with a mechanical brake, furling, a smaller rotor).
 */
export type Mode = "boost" | "boost-limited" | "bypass" | "overload";

export interface ControlPoint {
  rpm: number;
  /** Electrical frequency [Hz] */
  frequency: number;
  mode: Mode;
  /** Rectified DC current [A] */
  current: number;
  /** Rectified DC voltage [V] */
  voltage: number;
  /** Power drawn from the generator shaft [W] */
  shaftPower: number;
  /** Power at the rectifier output [W] */
  dcPower: number;
  /** Power delivered to the battery [W] */
  outputPower: number;
  /** Power above the ratings of the board that has to be avoided by braking or furling [W] */
  excessPower: number;
}

/** Maximum rectified power the boost stage can convert [W] */
export function boostPowerLimit(sys: WindSystem): number {
  return (sys.batteryVoltage * board.boostMaxOutputCurrent) / sys.boostEfficiency;
}

/**
 * Current the board would ideally draw from the generator at a given speed to keep the
 * turbine on its optimal power curve [A], ignoring the limits of the board.
 */
export function optimalCurrent(sys: WindSystem, rpm: number): number {
  const power = optimalCurvePower(sys.turbine, rpm);
  const current = currentForShaftPower(sys.generator, rpm, power);
  if (current !== undefined) return current;
  // The generator inductance limits the power: use the current at maximum shaft power
  return openCircuitDcVoltage(sys.generator, rpm) / (2 * commutationResistance(sys.generator, rpm));
}

/** Behavior of the board at a given generator speed */
export function controlPoint(sys: WindSystem, rpm: number): ControlPoint {
  const { generator, rectifier, batteryVoltage, boostEfficiency } = sys;
  const frequency = electricalFrequency(generator.poles, rpm);
  const op = (current: number) => dcOperatingPoint(generator, rectifier, true, rpm, current);

  let current = optimalCurrent(sys, rpm);
  let mode: Mode = "boost";

  // Limit current and power to the ratings of the rectifier and boost stage
  const powerLimit = boostPowerLimit(sys);
  if (current > board.rectifierMaxCurrent || op(current).power > powerLimit) {
    mode = "boost-limited";
    let low = 0;
    let high = Math.min(current, board.rectifierMaxCurrent);
    if (op(high).power <= powerLimit) {
      low = high;
    } else {
      for (let i = 0; i < 50; i++) {
        const mid = (low + high) / 2;
        if (op(mid).power <= powerLimit) low = mid;
        else high = mid;
      }
    }
    current = low;
  }

  // A boost converter can't operate with the input voltage above the output voltage
  if (op(current).voltage >= batteryVoltage) {
    current = currentAtClampedVoltage(generator, rectifier, true, rpm, batteryVoltage);
    mode = current > board.bypassMaxCurrent ? "overload" : "bypass";
  }

  const point = op(current);
  const boosting = mode === "boost" || mode === "boost-limited";
  const outputPower = boosting
    ? point.power * boostEfficiency
    : Math.min(point.power, batteryVoltage * board.bypassMaxCurrent);
  return {
    rpm,
    frequency,
    mode,
    current,
    voltage: point.voltage,
    shaftPower: point.shaftPower,
    dcPower: point.power,
    outputPower,
    excessPower: boosting ? 0 : point.power - outputPower,
  };
}

/** Behavior with a passive diode rectifier connected directly to the battery */
export function directControlPoint(sys: WindSystem, rpm: number): ControlPoint {
  const { generator, rectifier, batteryVoltage } = sys;
  const current = currentAtClampedVoltage(generator, rectifier, false, rpm, batteryVoltage);
  const point = dcOperatingPoint(generator, rectifier, false, rpm, current);
  return {
    rpm,
    frequency: electricalFrequency(generator.poles, rpm),
    mode: "bypass",
    current,
    voltage: current > 0 ? batteryVoltage : point.voltage,
    shaftPower: point.shaftPower,
    dcPower: point.power,
    outputPower: point.power,
    excessPower: 0,
  };
}

export interface SteadyState {
  windSpeed: number;
  /** Maximum power that could be extracted by the rotor [W] */
  idealPower: number;
  /** Operating point with the Spinvert Boost */
  board: ControlPoint;
  /** Operating point with a diode rectifier connected directly to the battery */
  direct: ControlPoint;
}

/**
 * Finds the speed at which the rotor power equals the power drawn by the load. If there are
 * several, the highest one is returned, as the rotor starts up from low load.
 */
function equilibrium(
  sys: WindSystem,
  windSpeed: number,
  load: (rpm: number) => ControlPoint,
): ControlPoint {
  const surplus = (rpm: number) => rotorPower(sys.turbine, windSpeed, rpm) - load(rpm).shaftPower;
  const maxRpm = runawayRpm(sys.turbine, windSpeed);
  const steps = 400;
  // The surplus is <= 0 at runaway speed. Scan downwards for the first sign change.
  let high = maxRpm;
  for (let i = steps - 1; i >= 0; i--) {
    let low = (maxRpm * i) / steps;
    if (surplus(low) >= 0) {
      for (let j = 0; j < 50; j++) {
        const mid = (low + high) / 2;
        if (surplus(mid) >= 0) low = mid;
        else high = mid;
      }
      return load(low);
    }
    high = low;
  }
  return load(0);
}

export function steadyState(sys: WindSystem, windSpeed: number): SteadyState {
  return {
    windSpeed,
    idealPower: maxRotorPower(sys.turbine, windSpeed),
    board: equilibrium(sys, windSpeed, (rpm) => controlPoint(sys, rpm)),
    direct: equilibrium(sys, windSpeed, (rpm) => directControlPoint(sys, rpm)),
  };
}

export interface CurvePoint {
  /** Electrical frequency [Hz] */
  frequency: number;
  rpm: number;
  /** Target rectified (boost input) current [A] */
  current: number;
  /** Expected rectified voltage [V] */
  voltage: number;
  /** Expected rectified power [W] */
  power: number;
}

/**
 * Lookup curve for the firmware: boost input current as a function of the electrical
 * frequency, from standstill up to the speed where the board switches to bypass.
 */
export function lookupCurve(sys: WindSystem, points: number): CurvePoint[] {
  // Find the speed where the boost stage stops operating
  let low = 0;
  let high = 1;
  while (controlPoint(sys, high).mode.startsWith("boost") && high < 1e5) high *= 2;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (controlPoint(sys, mid).mode.startsWith("boost")) low = mid;
    else high = mid;
  }
  const maxRpm = low;

  return Array.from({ length: points }, (_, i) => {
    const point = controlPoint(sys, (maxRpm * i) / (points - 1));
    return {
      frequency: point.frequency,
      rpm: point.rpm,
      current: point.current,
      voltage: point.voltage,
      power: point.dcPower,
    };
  });
}
