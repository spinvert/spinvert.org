/** Hardware parameters of the Spinvert Boost 4820 */
export const board = {
  /** Nominal output (battery / DC bus) voltage [V] */
  outputVoltage: 48,
  /** Maximum input voltage (rectified generator voltage) [V] */
  maxInputVoltage: 60,
  /** Maximum output current of the boost stage [A] */
  boostMaxOutputCurrent: 10,
  /** Maximum current through the active rectifier [A] */
  rectifierMaxCurrent: 20,
  /** Maximum current through the bypass path [A] */
  bypassMaxCurrent: 20,
  /** Maximum dump load current [A] */
  dumpLoadMaxCurrent: 20,
  /** Boost inductor [H] */
  boostInductance: 47e-6,
  /** Boost switching frequency [Hz] */
  switchingFrequency: 128e3,
} as const;
