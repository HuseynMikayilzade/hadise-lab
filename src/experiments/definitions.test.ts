import { describe, expect, it } from "vitest";
import { cryptoRng, seededRng } from "@/lib/engine/rng";
import { DEFAULT_CONTROL } from "@/lib/session/types";
import { EXPERIMENTS } from "./registry";
import { EXPERIMENT_IDS, type AnyExperiment, type EngineParams } from "./types";
import type { DiceSummary } from "./dice/definition";
import type { VennSummary } from "./venn/definition";
import type { BayesSummary } from "./bayes-test/definition";
import type { AbSummary } from "./ab-test/definition";
import type { PiSummary } from "./monte-carlo/definition";
import type { BirthdaySummary } from "./birthday/definition";
import { longestRunDistribution, switchDistribution } from "./random-seq/definition";

function initialParams(def: AnyExperiment): EngineParams {
  return Object.fromEntries((def.engine?.params ?? []).map((p) => [p.key, p.initial]));
}

/** Mühərriki n sınaq işlədir və (açılmış həqiqətlə) xülasə qaytarır. */
function run(def: AnyExperiment, trials: number, seed: number | null) {
  const engine = def.engine!;
  const rng = seed === null ? cryptoRng() : seededRng(seed);
  const params = initialParams(def);
  const truth = engine.drawHiddenTruth(rng, params);
  const model = engine.initModel(params);
  for (let i = 0; i < trials; i += 1) engine.updateModel(model, engine.runTrial(truth, rng, params, model), "sim");
  return { truth, hidden: engine.summarize(model, null, params), revealed: engine.summarize(model, truth, params) };
}

describe("every experiment definition", () => {
  it.each(EXPERIMENT_IDS)("%s computes an empty view and has an engine", (id) => {
    const def = EXPERIMENTS[id];
    const agg = def.decodeAggregate({ hash: {}, lists: {} });
    expect(() => def.computeView(agg, DEFAULT_CONTROL)).not.toThrow();
    expect(def.engine).toBeDefined();
    expect(def.title).not.toMatch(/—/);
  });

  it.each(EXPERIMENT_IDS)("%s engine runs 2000 trials and never leaks the truth before reveal", (id) => {
    const { hidden } = run(EXPERIMENTS[id], 2000, 1);
    expect(JSON.stringify(hidden)).not.toContain('"truth":{');
  });

  // Zər yarı ehtimalla düzgündür (iki düzgün zər eynidir), ona görə 20 çəkiliş arasında fərqli həqiqətlər axtarılır:
  // hamısının eyni olma ehtimalı 0,5^19 ≈ 2·10⁻⁶.
  it.each(["dice", "seasons", "venn", "bayes-test", "ab-test"] as const)("%s draws varying hidden truths across crypto runs", (id) => {
    const truths = Array.from({ length: 20 }, () => JSON.stringify(run(EXPERIMENTS[id], 1, null).truth));
    expect(new Set(truths).size).toBeGreaterThan(1);
  });
});

describe("autonomous learning converges to the hidden truth", () => {
  it("dice: posterior means approach the true face probabilities", () => {
    const { revealed } = run(EXPERIMENTS.dice, 30_000, 4);
    const s = revealed as DiceSummary;
    s.posteriors.forEach((p, i) => expect(Math.abs(p.value - s.truth!.probabilities[i])).toBeLessThan(0.015));
  });

  it("venn: learned conditionals approach the truth", () => {
    const { revealed } = run(EXPERIMENTS.venn, 30_000, 6);
    const s = revealed as VennSummary;
    expect(Math.abs(s.view.aGivenB.bayes.value - s.truth!.aGivenB)).toBeLessThan(0.02);
    expect(Math.abs(s.view.aGivenNotB.bayes.value - s.truth!.aGivenNotB)).toBeLessThan(0.02);
  });

  it("bayes-test: empirical P(ill | +) approaches the Bayes formula for the hidden parameters", () => {
    const { revealed } = run(EXPERIMENTS["bayes-test"], 200_000, 8);
    const s = revealed as BayesSummary;
    expect(Math.abs(s.estimate.bayes.value - s.truth!.answer)).toBeLessThan(0.025);
    expect(s.patient?.tests.length).toBeGreaterThan(1);
  });

  it("ab-test: Thompson sends most traffic to the best variant and beats the split", () => {
    const { revealed } = run(EXPERIMENTS["ab-test"], 5000, 12);
    const s = revealed as AbSummary;
    const best = s.truth!.rates.indexOf(Math.max(...s.truth!.rates));
    const shows = s.thompson.map((a) => a.shows);
    expect(shows.indexOf(Math.max(...shows))).toBe(best);
    expect(s.thompsonRegret).toBeLessThan(s.splitRegret);
  });

  it("monte-carlo: π within tolerance", () => {
    const s = run(EXPERIMENTS["monte-carlo"], 100_000, 3).revealed as PiSummary;
    expect(Math.abs(s.view.pi!.value - Math.PI)).toBeLessThan(0.02);
    expect(s.view.points).toHaveLength(2000);
  });

  it("birthday: simulation agrees with the complement formula", () => {
    const s = run(EXPERIMENTS.birthday, 20_000, 5).revealed as BirthdaySummary;
    expect(Math.abs(s.estimate.bayes.value - s.exact)).toBeLessThan(0.015);
  });
});

describe("random sequences: exact reference distributions", () => {
  it("are proper distributions", () => {
    const runs = longestRunDistribution();
    const switches = switchDistribution();
    expect(runs.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 10);
    expect(switches.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 10);
    // Müstəqil yoxlama: seriyası ≤ 3 olan ardıcıllıqlar a(n) = a(n-1) + a(n-2) + a(n-3), a(20) = 242830.
    expect(runs.slice(4).reduce((s, p) => s + p, 0)).toBeCloseTo(1 - 242830 / 2 ** 20, 10);
  });
});
