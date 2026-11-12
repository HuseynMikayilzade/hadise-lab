import { describe, expect, it } from "vitest";
import { cryptoRng, seededRng } from "./rng";
import { beta, categorical, dirichlet, gamma } from "./samplers";
import { betaFromCounts, betaMean, betaQuantile, betaVariance, credibleInterval, dirichletMarginal } from "./conjugate";
import { chiSquareGof, chiSquareSurvival } from "./chisq";
import { estimateOddsRatio, jointFromOddsRatio } from "./oddsRatio";
import { compareBandits } from "./thompson";
import { accuracy, createLogistic, trainStep } from "./logistic";
import { createHistory, recordHistory } from "./history";

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const variance = (xs: number[]) => {
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
};

describe("random sources", () => {
  it("seeded generator is reproducible and different seeds differ", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const c = seededRng(43);
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(seqA);
  });

  it("crypto source stays in [0, 1) and is not constant", () => {
    const rng = cryptoRng();
    const xs = Array.from({ length: 10_000 }, () => rng.next());
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(mean(xs)).toBeCloseTo(0.5, 1);
    expect(rng.seed).toBeNull();
  });

  it("int() covers the full range uniformly", () => {
    const rng = seededRng(7);
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 60_000; i += 1) counts[rng.int(6)] += 1;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(400);
  });
});

describe("samplers", () => {
  it("Gamma(k) has mean k and variance k (also for k < 1)", () => {
    for (const k of [0.5, 2, 7.5]) {
      const rng = seededRng(11);
      const xs = Array.from({ length: 40_000 }, () => gamma(rng, k));
      expect(mean(xs)).toBeCloseTo(k, 1);
      expect(Math.abs(variance(xs) - k) / k).toBeLessThan(0.05);
    }
  });

  it("Beta(2, 5) moments match theory", () => {
    const rng = seededRng(5);
    const xs = Array.from({ length: 40_000 }, () => beta(rng, 2, 5));
    expect(mean(xs)).toBeCloseTo(2 / 7, 2);
    expect(variance(xs)).toBeCloseTo((2 * 5) / (49 * 8), 3);
  });

  it("Dirichlet components have the right means and sum to 1", () => {
    const rng = seededRng(9);
    const alphas = [1, 2, 3, 4];
    const draws = Array.from({ length: 20_000 }, () => dirichlet(rng, alphas));
    for (const d of draws.slice(0, 50)) expect(d.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 10);
    alphas.forEach((a, i) => {
      const component = draws.map((d) => d[i]);
      expect(mean(component)).toBeCloseTo(a / 10, 2);
      // Var = α_i(α0 - α_i) / (α0²(α0 + 1))
      expect(variance(component)).toBeCloseTo((a * (10 - a)) / (100 * 11), 3);
    });
  });

  it("categorical follows the given probabilities", () => {
    const rng = seededRng(3);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i += 1) counts[categorical(rng, [0.2, 0.5, 0.3])] += 1;
    expect(counts[1] / 30_000).toBeCloseTo(0.5, 1);
  });
});

describe("conjugate updates", () => {
  it("Beta-Binomial posterior after 7 successes in 10 trials", () => {
    const post = betaFromCounts(7, 3);
    expect(post).toEqual({ alpha: 8, beta: 4 });
    expect(betaMean(post)).toBeCloseTo(8 / 12, 10);
    expect(betaVariance(post)).toBeCloseTo((8 * 4) / (144 * 13), 10);
  });

  it("Beta quantiles match reference values", () => {
    // Beta(1,1) uniform; Beta(2,2) median 0,5; Beta(8,4) 2,5% ≈ 0,3902 and 97,5% ≈ 0,8907
    expect(betaQuantile(0.3, { alpha: 1, beta: 1 })).toBeCloseTo(0.3, 6);
    expect(betaQuantile(0.5, { alpha: 2, beta: 2 })).toBeCloseTo(0.5, 6);
    const ci = credibleInterval({ alpha: 8, beta: 4 });
    expect(ci.lower).toBeCloseTo(0.3902, 3);
    expect(ci.upper).toBeCloseTo(0.8907, 3);
  });

  it("Dirichlet marginal is Beta(α_i, α0 - α_i)", () => {
    expect(dirichletMarginal([2, 3, 5], 1)).toEqual({ alpha: 3, beta: 7 });
  });
});

describe("chi-square", () => {
  it("survival function matches tables", () => {
    expect(chiSquareSurvival(11.0705, 5)).toBeCloseTo(0.05, 3);
    expect(chiSquareSurvival(3.8415, 1)).toBeCloseTo(0.05, 3);
  });

  it("refuses a verdict when expected counts are below 5", () => {
    const fair = new Array(6).fill(1 / 6);
    expect(chiSquareGof([5, 4, 5, 6, 4, 5], fair)).toEqual({ kind: "insufficient", minN: 30 });
    const result = chiSquareGof([5, 5, 5, 5, 5, 5], fair);
    expect(result.kind).toBe("ok");
  });

  it("detects a strongly loaded die", () => {
    const result = chiSquareGof([10, 10, 10, 10, 10, 90], new Array(6).fill(1 / 6));
    expect(result.kind === "ok" && result.reject).toBe(true);
  });
});

describe("odds ratio", () => {
  it("OR = 1 gives independence", () => {
    const j = jointFromOddsRatio(0.4, 0.6, 1);
    expect(j.both).toBeCloseTo(0.24, 10);
  });

  it("joint distribution reproduces the requested marginals and OR", () => {
    const j = jointFromOddsRatio(0.3, 0.55, 4);
    expect(j.both + j.aOnly).toBeCloseTo(0.3, 10);
    expect(j.both + j.bOnly).toBeCloseTo(0.55, 10);
    expect((j.both * j.neither) / (j.aOnly * j.bOnly)).toBeCloseTo(4, 8);
    expect(Math.min(j.both, j.aOnly, j.bOnly, j.neither)).toBeGreaterThan(0);
  });

  it("sample OR with Woolf interval", () => {
    const est = estimateOddsRatio({ both: 20, aOnly: 10, bOnly: 10, neither: 20 })!;
    expect(est.value).toBeCloseTo(4, 10);
    expect(est.interval.lower).toBeLessThan(4);
    expect(est.interval.upper).toBeGreaterThan(4);
  });
});

describe("Thompson sampling", () => {
  it("beats an equal split in at least 90% of 50 seeded runs (5k visitors)", () => {
    let wins = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      const rng = seededRng(seed * 7919);
      const rates = [0, 1, 2].map(() => 0.02 + 0.1 * rng.next());
      const { thompsonRegret, splitRegret } = compareBandits(rates, 5000, rng);
      if (thompsonRegret < splitRegret) wins += 1;
    }
    expect(wins).toBeGreaterThanOrEqual(45);
  });
});

describe("online logistic regression", () => {
  it("learns a linearly separable rule", () => {
    const model = createLogistic(1, 0.2);
    const rng = seededRng(1);
    for (let i = 0; i < 2000; i += 1) {
      const x = rng.next() * 4 - 2;
      trainStep(model, [x], x > 0 ? 1 : 0);
    }
    expect(accuracy(model)!).toBeGreaterThan(0.9);
  });
});

describe("bounded history", () => {
  it("never exceeds capacity and covers the whole range", () => {
    const h = createHistory<number>(100);
    for (let i = 1; i <= 100_000; i += 1) recordHistory(h, i);
    expect(h.points.length).toBeLessThan(100);
    expect(h.points[h.points.length - 1]).toBeGreaterThan(90_000);
    expect(h.points[0]).toBeLessThan(5_000);
  });
});
