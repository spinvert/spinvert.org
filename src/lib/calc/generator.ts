/**
 * Model of a 3-phase permanent magnet synchronous generator (PMSG) connected to a 3-phase bridge
 * rectifier (six-pulse rectifier).
 *
 * All phase quantities refer to the star (Y) equivalent circuit. A delta-connected generator
 * can be described by its star equivalent with the same line-to-line values.
 */

/** Ratio of rectified open-circuit DC voltage to line-to-line RMS voltage: 3·√2/π ≈ 1.35 */
export const RECTIFIER_FACTOR = (3 * Math.SQRT2) / Math.PI;

export interface Generator {
  /** Number of magnet poles (not pole pairs) */
  poles: number;
  /** Open-circuit line-to-line RMS voltage per 1000 rpm [V/krpm] */
  ke: number;
  /** Phase resistance (star equivalent) [Ω] */
  phaseResistance: number;
  /** Phase inductance (star equivalent) [H] */
  phaseInductance: number;
}

export interface Rectifier {
  /** Forward voltage per diode [V], used for passive diode rectification */
  diodeForwardVoltage: number;
  /** On-resistance per MOSFET [Ω], used for active rectification */
  mosfetResistance: number;
}

/** Electrical frequency of the generator voltage [Hz] */
export function electricalFrequency(poles: number, rpm: number): number {
  return (poles * rpm) / 120;
}

/** Mechanical speed derived from the electrical frequency [rpm] */
export function rpmFromFrequency(poles: number, frequency: number): number {
  return (120 * frequency) / poles;
}

/** Mechanical angular speed [rad/s] */
export function angularSpeed(rpm: number): number {
  return (2 * Math.PI * rpm) / 60;
}

/** Mechanical speed [rpm] from angular speed [rad/s] */
export function rpmFromAngularSpeed(omega: number): number {
  return (60 * omega) / (2 * Math.PI);
}

/** Open-circuit line-to-line RMS voltage [V] */
export function lineVoltage(gen: Generator, rpm: number): number {
  return (gen.ke * rpm) / 1000;
}

/** Rectified open-circuit DC voltage [V] */
export function openCircuitDcVoltage(gen: Generator, rpm: number): number {
  return RECTIFIER_FACTOR * lineVoltage(gen, rpm);
}

/**
 * Equivalent DC-side resistance caused by commutation overlap (3·ω_e·L/π) [Ω].
 *
 * The phase inductance delays the transfer of current from one phase to the next. This
 * reduces the DC voltage proportional to the current, but it is not a loss: the power is
 * simply not drawn from the generator.
 */
export function commutationResistance(gen: Generator, rpm: number): number {
  const omegaE = 2 * Math.PI * electricalFrequency(gen.poles, rpm);
  return (3 * omegaE * gen.phaseInductance) / Math.PI;
}

/** Copper losses in the generator windings for a given DC current [W] */
export function copperLosses(gen: Generator, current: number): number {
  // Two phases conduct at any time, so the windings appear as 2·R on the DC side
  return 2 * gen.phaseResistance * current ** 2;
}

/** Losses in the rectifier bridge for a given DC current [W] */
export function rectifierLosses(rect: Rectifier, active: boolean, current: number): number {
  // Two devices are always in the current path. With 1/3 conduction time per device, the sum
  // over all six devices results in the same expressions.
  return active
    ? 2 * rect.mosfetResistance * current ** 2
    : 2 * rect.diodeForwardVoltage * Math.abs(current);
}

/**
 * Electrical operating point of generator and rectifier at a given speed and DC current.
 */
export interface DcOperatingPoint {
  /** DC current [A] */
  current: number;
  /** Rectified DC voltage under load [V] */
  voltage: number;
  /** Electrical power at the rectifier output [W] */
  power: number;
  /** Power drawn from the generator shaft (excluding mechanical and iron losses) [W] */
  shaftPower: number;
}

export function dcOperatingPoint(
  gen: Generator,
  rect: Rectifier,
  active: boolean,
  rpm: number,
  current: number,
): DcOperatingPoint {
  const v0 = openCircuitDcVoltage(gen, rpm);
  const shaftPower = (v0 - commutationResistance(gen, rpm) * current) * current;
  const power = shaftPower - copperLosses(gen, current) - rectifierLosses(rect, active, current);
  return {
    current,
    voltage: current > 0 ? power / current : v0,
    power,
    shaftPower,
  };
}

/**
 * DC current required to draw the given shaft power from the generator [A].
 *
 * Returns `undefined` if the generator cannot deliver this power at the given speed because of
 * the voltage drop across its inductance.
 */
export function currentForShaftPower(
  gen: Generator,
  rpm: number,
  shaftPower: number,
): number | undefined {
  // Solve (V0 - Xc·I)·I = P for the smaller of both solutions
  const v0 = openCircuitDcVoltage(gen, rpm);
  const xc = commutationResistance(gen, rpm);
  if (shaftPower <= 0) return 0;
  if (xc === 0) return v0 > 0 ? shaftPower / v0 : undefined;
  const discriminant = v0 ** 2 - 4 * xc * shaftPower;
  if (discriminant < 0) return undefined;
  return (v0 - Math.sqrt(discriminant)) / (2 * xc);
}

/**
 * DC current if the rectifier output is clamped to a fixed voltage, e.g. a battery [A].
 */
export function currentAtClampedVoltage(
  gen: Generator,
  rect: Rectifier,
  active: boolean,
  rpm: number,
  voltage: number,
): number {
  const v0 = openCircuitDcVoltage(gen, rpm);
  const xc = commutationResistance(gen, rpm);
  const r = 2 * gen.phaseResistance + (active ? 2 * rect.mosfetResistance : 0);
  const drop = active ? 0 : 2 * rect.diodeForwardVoltage;
  return Math.max(0, (v0 - drop - voltage) / (xc + r));
}

/**
 * Generator with the same magnets and copper volume, but rewound for a different voltage
 * constant. The number of turns scales with k_e, so resistance and inductance scale with k_e².
 */
export function rewindGenerator(gen: Generator, ke: number): Generator {
  const factor = (ke / gen.ke) ** 2;
  return {
    ...gen,
    ke,
    phaseResistance: gen.phaseResistance * factor,
    phaseInductance: gen.phaseInductance * factor,
  };
}

export interface GeneratorMeasurement {
  /** Speed during the measurement [rpm] */
  rpm: number;
  /** Open-circuit line-to-line RMS voltage [V] */
  lineVoltage: number;
  /** Frequency of the line voltage [Hz] */
  frequency: number;
  /** Resistance measured between two terminals [Ω] */
  lineResistance: number;
  /** Inductance measured between two terminals [H] */
  lineInductance: number;
}

export interface GeneratorCharacterization {
  generator: Generator;
  /** Pole count before rounding to an even integer */
  polesExact: number;
}

/** Derives the generator model parameters from simple measurements */
export function characterizeGenerator(m: GeneratorMeasurement): GeneratorCharacterization {
  const polesExact = (120 * m.frequency) / m.rpm;
  return {
    generator: {
      poles: Math.max(2, 2 * Math.round(polesExact / 2)),
      ke: (m.lineVoltage / m.rpm) * 1000,
      // Between two terminals, two phases are measured in series
      phaseResistance: m.lineResistance / 2,
      phaseInductance: m.lineInductance / 2,
    },
    polesExact,
  };
}
