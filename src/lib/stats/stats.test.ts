import { describe, expect, it } from "vitest";
import { seededRng } from "@/lib/engine/rng";
import { birthdayMatchProbability, simulateGroupHasMatch } from "./birthday";
import { DEFAULT_SCENARIO, naturalFrequencies, posteriorGivenPositive, updateAfterTest } from "./bayes";
import { estimatePi, insideCircle, randomPoint, decodePoint, encodePoint } from "./montecarlo";
import { longestRun, randomSequence, switchCount } from "./runs";
import { bernoulli } from "@/lib/engine/samplers";

describe("birthday paradox", () => {
  it("matches reference values", () => {
    expect(birthdayMatchProbability(23)).toBeCloseTo(0.507, 3);
    expect(birthdayMatchProbability(30)).toBeCloseTo(0.706, 3);
    expect(birthdayMatchProbability(1)).toBe(0);
    expect(birthdayMatchProbability(366)).toBe(1);
  });

  it("simulation converges to the formula", () => {
    const rng = seededRng(23);
    let hits = 0;
    const groups = 20_000;
    for (let i = 0; i < groups; i += 1) if (simulateGroupHasMatch(23, rng)) hits += 1;
    expect(Math.abs(hits / groups - 0.5073)).toBeLessThan(0.015);
  });
});

describe("Bayes test scenario", () => {
  it("posterior for the default scenario ≈ 0,0917", () => {
    expect(posteriorGivenPositive(DEFAULT_SCENARIO)).toBeCloseTo(0.0917, 4);
  });

  it("natural frequencies agree with Bayes", () => {
    const f = naturalFrequencies(DEFAULT_SCENARIO);
    expect(f.ill).toBeCloseTo(10, 10);
    expect(f.illPositive).toBeCloseTo(9, 10);
    expect(f.healthyPositive).toBeCloseTo(89.1, 10);
    expect(f.illPositive / f.positive).toBeCloseTo(0.0917, 4);
  });

  it("population simulation converges to ≈ 0,0917", () => {
    const rng = seededRng(2024);
    let positives = 0;
    let illPositives = 0;
    for (let i = 0; i < 400_000; i += 1) {
      const ill = bernoulli(rng, DEFAULT_SCENARIO.prevalence);
      const positive = bernoulli(rng, ill ? DEFAULT_SCENARIO.sensitivity : DEFAULT_SCENARIO.falsePositiveRate);
      if (positive) {
        positives += 1;
        if (ill) illPositives += 1;
      }
    }
    expect(Math.abs(illPositives / positives - 0.0917)).toBeLessThan(0.006);
  });

  it("two positive tests in a row raise the posterior", () => {
    const first = updateAfterTest(0.01, true, DEFAULT_SCENARIO);
    const second = updateAfterTest(first, true, DEFAULT_SCENARIO);
    expect(first).toBeCloseTo(0.0917, 4);
    expect(second).toBeGreaterThan(0.45);
  });
});

describe("Monte Carlo π", () => {
  it("estimate is within tolerance after 100k points", () => {
    const rng = seededRng(314);
    let inside = 0;
    const total = 100_000;
    for (let i = 0; i < total; i += 1) if (insideCircle(randomPoint(rng))) inside += 1;
    const est = estimatePi(inside, total)!;
    expect(Math.abs(est.value - Math.PI)).toBeLessThan(0.02);
    expect(est.interval.lower).toBeLessThan(Math.PI);
    expect(est.interval.upper).toBeGreaterThan(Math.PI);
  });

  it("point encoding round-trips and rejects garbage", () => {
    expect(decodePoint(encodePoint({ x: 0.12345, y: 0.9 }))).toEqual({ x: 0.1235, y: 0.9 });
    expect(decodePoint("abc")).toBeNull();
  });
});

describe("run statistics", () => {
  it("longest run and switches", () => {
    expect(longestRun("GGGRRG")).toBe(3);
    expect(switchCount("GGGRRG")).toBe(2);
    expect(longestRun("GRGRGR")).toBe(1);
  });

  it("random 20-flip sequences usually contain a run of 4+", () => {
    const rng = seededRng(8);
    let withLongRun = 0;
    for (let i = 0; i < 5000; i += 1) if (longestRun(randomSequence(rng)) >= 4) withLongRun += 1;
    expect(withLongRun / 5000).toBeGreaterThan(0.7);
  });
});
