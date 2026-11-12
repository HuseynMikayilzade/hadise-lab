import { describe, expect, it } from "vitest";
import { assessIndependence, computeStats, EMPTY_COUNTS, formatProbability, wilsonInterval } from "./probability";

describe("wilsonInterval", () => {
  it("matches reference values for 5/10", () => {
    const ci = wilsonInterval(5, 10)!;
    expect(ci.lower).toBeCloseTo(0.2366, 3);
    expect(ci.upper).toBeCloseTo(0.7634, 3);
  });

  it("stays inside [0, 1] at the boundaries", () => {
    const zero = wilsonInterval(0, 10)!;
    expect(zero.lower).toBe(0);
    expect(zero.upper).toBeCloseTo(0.2775, 3);

    const all = wilsonInterval(10, 10)!;
    expect(all.upper).toBeCloseTo(1, 10);
    expect(all.lower).toBeCloseTo(0.7225, 3);
  });

  it("rejects invalid input", () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(-1, 10)).toBeNull();
    expect(wilsonInterval(11, 10)).toBeNull();
    expect(wilsonInterval(1.5, 10)).toBeNull();
  });
});

describe("computeStats", () => {
  it("returns nulls for an empty experiment", () => {
    const s = computeStats(EMPTY_COUNTS);
    expect(s.n).toBe(0);
    expect(s.pA).toBeNull();
    expect(s.independenceProduct).toBeNull();
  });

  it("computes marginal, joint and conditional probabilities", () => {
    // Təqdimatdakı sorğu nümunəsi: n = 200
    const s = computeStats({ aOnly: 24, bOnly: 48, both: 32, neither: 96 });
    expect(s.n).toBe(200);
    expect(s.pA!.value).toBeCloseTo(0.28);
    expect(s.pB!.value).toBeCloseTo(0.4);
    expect(s.pAB!.value).toBeCloseTo(0.16);
    expect(s.pAGivenB!.value).toBeCloseTo(0.4);
    expect(s.pAGivenNotB!.value).toBeCloseTo(0.2);
    expect(s.independenceProduct).toBeCloseTo(0.112);
  });

  it("leaves P(A | B) undefined when B never occurred", () => {
    const s = computeStats({ aOnly: 3, bOnly: 0, both: 0, neither: 2 });
    expect(s.pAGivenB).toBeNull();
  });
});

describe("assessIndependence", () => {
  it("requires a minimum sample size", () => {
    const v = assessIndependence(computeStats({ aOnly: 1, bOnly: 1, both: 1, neither: 1 }));
    expect(v.kind).toBe("insufficient");
  });

  it("detects clear dependence", () => {
    const v = assessIndependence(computeStats({ aOnly: 5, bOnly: 5, both: 95, neither: 95 }));
    expect(v.kind).toBe("dependent");
  });

  it("is inconclusive for balanced data", () => {
    const v = assessIndependence(computeStats({ aOnly: 10, bOnly: 10, both: 10, neither: 10 }));
    expect(v.kind).toBe("inconclusive");
  });
});

describe("formatProbability", () => {
  it("uses a decimal comma", () => {
    expect(formatProbability(0.25)).toBe("0,25");
    expect(formatProbability(0.5)).toBe("0,50");
  });
});
