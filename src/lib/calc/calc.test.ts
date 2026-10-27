/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { board } from "./board";
import { boostOperatingPoint, inductorCurrentWaveform } from "./boost";
import {
  type Generator,
  type Rectifier,
  characterizeGenerator,
  currentForShaftPower,
  dcOperatingPoint,
  electricalFrequency,
  openCircuitDcVoltage,
  rpmFromFrequency,
} from "./generator";
import { type WindSystem, controlPoint, lookupCurve, steadyState } from "./operating";
import {
  type Turbine,
  maxRotorPower,
  optimalCurvePower,
  optimalRpm,
  powerCoefficient,
  rotorPower,
  runawayTsr,
} from "./wind";

const turbine: Turbine = { radius: 1, cpMax: 0.38, tsrOpt: 6, airDensity: 1.225 };
const generator: Generator = { poles: 16, ke: 70, phaseResistance: 0.2, phaseInductance: 0.8e-3 };
const rectifier: Rectifier = { diodeForwardVoltage: 0.8, mosfetResistance: 0.005 };
const system: WindSystem = {
  turbine,
  generator,
  rectifier,
  batteryVoltage: 48,
  boostEfficiency: 0.95,
};

describe("generator", () => {
  test("frequency and speed", () => {
    expect(electricalFrequency(16, 600)).toBe(80);
    expect(rpmFromFrequency(16, 80)).toBe(600);
  });

  test("rectified open-circuit voltage", () => {
    // 70 V/krpm at 1000 rpm, 1.35 times the line-to-line RMS voltage
    expect(openCircuitDcVoltage(generator, 1000)).toBeCloseTo(94.53, 2);
  });

  test("current for shaft power is consistent with operating point", () => {
    const current = currentForShaftPower(generator, 500, 300)!;
    const op = dcOperatingPoint(generator, rectifier, true, 500, current);
    expect(op.shaftPower).toBeCloseTo(300, 6);
    expect(op.power).toBeLessThan(300);
  });

  test("current for shaft power beyond generator capability", () => {
    expect(currentForShaftPower(generator, 100, 1e6)).toBeUndefined();
  });

  test("characterization from measurements", () => {
    const result = characterizeGenerator({
      rpm: 600,
      lineVoltage: 42,
      frequency: 79,
      lineResistance: 0.8,
      lineInductance: 4e-3,
    });
    expect(result.polesExact).toBeCloseTo(15.8, 6);
    expect(result.generator).toEqual({
      poles: 16,
      ke: 70,
      phaseResistance: 0.4,
      phaseInductance: 2e-3,
    });
  });
});

describe("wind turbine", () => {
  test("power coefficient peaks at the optimal tip speed ratio", () => {
    expect(powerCoefficient(turbine, turbine.tsrOpt)).toBeCloseTo(turbine.cpMax, 4);
    expect(powerCoefficient(turbine, turbine.tsrOpt * 0.9)).toBeLessThan(turbine.cpMax);
    expect(powerCoefficient(turbine, turbine.tsrOpt * 1.1)).toBeLessThan(turbine.cpMax);
  });

  test("runaway tip speed ratio is above the optimum", () => {
    const tsr = runawayTsr(turbine);
    expect(tsr / turbine.tsrOpt).toBeGreaterThan(1.4);
    expect(tsr / turbine.tsrOpt).toBeLessThan(1.8);
    expect(powerCoefficient(turbine, tsr)).toBeCloseTo(0, 6);
  });

  test("optimal curve passes through the maximum power points", () => {
    for (const v of [4, 8, 12]) {
      const rpm = optimalRpm(turbine, v);
      expect(rotorPower(turbine, v, rpm)).toBeCloseTo(maxRotorPower(turbine, v), 0);
      expect(optimalCurvePower(turbine, rpm)).toBeCloseTo(maxRotorPower(turbine, v), 6);
    }
  });
});

describe("operating point", () => {
  test("boost mode at low wind speeds tracks the optimum", () => {
    const state = steadyState(system, 5);
    expect(state.board.mode).toBe("boost");
    expect(state.board.rpm).toBeCloseTo(optimalRpm(turbine, 5), -1);
    expect(state.board.shaftPower).toBeCloseTo(state.idealPower, -1);
  });

  test("direct connection produces nothing at low wind speeds", () => {
    expect(steadyState(system, 4).direct.outputPower).toBe(0);
  });

  test("board respects the output current ratings", () => {
    for (let v = 1; v <= 20; v++) {
      const { board: op } = steadyState(system, v);
      const outputCurrent = op.outputPower / system.batteryVoltage;
      if (op.mode.startsWith("boost")) {
        expect(outputCurrent).toBeLessThanOrEqual(board.boostMaxOutputCurrent + 1e-6);
      } else {
        expect(outputCurrent).toBeLessThanOrEqual(board.bypassMaxCurrent + 1e-6);
      }
    }
  });

  test("bypass above battery voltage", () => {
    const op = controlPoint(system, 1500);
    expect(op.mode === "bypass" || op.mode === "overload").toBe(true);
    expect(op.voltage).toBeCloseTo(system.batteryVoltage, 6);
  });

  test("lookup curve ends where boost operation ends", () => {
    const curve = lookupCurve(system, 16);
    expect(curve).toHaveLength(16);
    expect(curve[0].current).toBe(0);
    const last = curve.at(-1)!;
    expect(controlPoint(system, last.rpm).mode.startsWith("boost")).toBe(true);
    expect(controlPoint(system, last.rpm * 1.01).mode.startsWith("boost")).toBe(false);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].frequency).toBeGreaterThan(curve[i - 1].frequency);
    }
  });
});

describe("boost converter", () => {
  const conv = { inductance: board.boostInductance, frequency: board.switchingFrequency };

  test("CCM duty cycle and ripple", () => {
    const op = boostOperatingPoint(conv, 24, 48, 240);
    expect(op.mode).toBe("CCM");
    expect(op.dutyCycle).toBeCloseTo(0.5, 6);
    expect(op.inputCurrent).toBeCloseTo(10, 6);
    expect(op.ripple).toBeCloseTo((24 * 0.5) / (47e-6 * 128e3), 6);
  });

  test("DCM at light load", () => {
    const op = boostOperatingPoint(conv, 24, 48, 10);
    expect(op.mode).toBe("DCM");
    expect(op.dutyCycle).toBeLessThan(0.5);
    // Average of the triangular current equals the input current
    const avg = (op.peakCurrent * (op.dutyCycle + op.demagnetizingTime)) / 2;
    expect(avg).toBeCloseTo(op.inputCurrent, 6);
  });

  test("waveform", () => {
    const op = boostOperatingPoint(conv, 24, 48, 240);
    const wave = inductorCurrentWaveform(conv, op, 2);
    expect(wave).toHaveLength(7);
    expect(Math.max(...wave.map(([, i]) => i))).toBeCloseTo(op.peakCurrent, 6);
  });
});
