/**
 * Idealized (lossless) boost converter
 */

export interface BoostConverter {
  /** Inductance [H] */
  inductance: number;
  /** Switching frequency [Hz] */
  frequency: number;
}

export interface BoostOperatingPoint {
  /** Continuous (CCM) or discontinuous (DCM) conduction mode */
  mode: "CCM" | "DCM";
  /** Duty cycle of the low-side switch */
  dutyCycle: number;
  /** Average inductor (input) current [A] */
  inputCurrent: number;
  /** Average output current [A] */
  outputCurrent: number;
  /** Peak-to-peak inductor current ripple [A] */
  ripple: number;
  /** Peak inductor current [A] */
  peakCurrent: number;
  /** Lowest inductor current within a switching period [A] */
  valleyCurrent: number;
  /** Fraction of the switching period with the high-side switch conducting */
  demagnetizingTime: number;
}

export function boostOperatingPoint(
  conv: BoostConverter,
  inputVoltage: number,
  outputVoltage: number,
  power: number,
): BoostOperatingPoint {
  const { inductance: l, frequency: f } = conv;
  const inputCurrent = power / inputVoltage;
  const outputCurrent = power / outputVoltage;

  const ccmDuty = 1 - inputVoltage / outputVoltage;
  const ccmRipple = (inputVoltage * ccmDuty) / (l * f);
  if (inputCurrent >= ccmRipple / 2) {
    return {
      mode: "CCM",
      dutyCycle: ccmDuty,
      inputCurrent,
      outputCurrent,
      ripple: ccmRipple,
      peakCurrent: inputCurrent + ccmRipple / 2,
      valleyCurrent: inputCurrent - ccmRipple / 2,
      demagnetizingTime: 1 - ccmDuty,
    };
  }

  // In DCM, the inductor current returns to zero in every period and the duty cycle depends on
  // the load: I_in = V_in·D²/(2·L·f) · V_out/(V_out - V_in)
  const dutyCycle = Math.sqrt(
    (2 * l * f * inputCurrent * (outputVoltage - inputVoltage)) / (inputVoltage * outputVoltage),
  );
  const peakCurrent = (inputVoltage * dutyCycle) / (l * f);
  return {
    mode: "DCM",
    dutyCycle,
    inputCurrent,
    outputCurrent,
    ripple: peakCurrent,
    peakCurrent,
    valleyCurrent: 0,
    demagnetizingTime: (dutyCycle * inputVoltage) / (outputVoltage - inputVoltage),
  };
}

/** Inductor current waveform over the given number of switching periods, as [time, current] */
export function inductorCurrentWaveform(
  conv: BoostConverter,
  op: BoostOperatingPoint,
  periods: number,
): [number, number][] {
  const period = 1 / conv.frequency;
  const points: [number, number][] = [];
  for (let i = 0; i < periods; i++) {
    const t0 = i * period;
    points.push([t0, op.valleyCurrent]);
    points.push([t0 + op.dutyCycle * period, op.peakCurrent]);
    points.push([t0 + (op.dutyCycle + op.demagnetizingTime) * period, op.valleyCurrent]);
  }
  points.push([periods * period, op.valleyCurrent]);
  return points;
}
