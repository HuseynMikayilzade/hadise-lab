/**
 * Domen məntiqi: hadisələrin sayından ehtimalların və etibarlılıq
 * intervallarının hesablanması. UI və saxlama qatından tam asılı deyil.
 */

/** 2×2 cədvəlin dörd xanası: Ω-nın kəsişməyən hissələri (tam qrup). */
export interface EventCounts {
  aOnly: number;
  bOnly: number;
  both: number;
  neither: number;
}

export interface Interval {
  lower: number;
  upper: number;
}

export interface Estimate {
  value: number;
  interval: Interval;
}

export interface ExperimentStats {
  n: number;
  pA: Estimate | null;
  pB: Estimate | null;
  pAB: Estimate | null;
  /** P(A | B) - B baş verənlər arasında A-nın payı */
  pAGivenB: Estimate | null;
  /** P(A | B̄) - B baş verməyənlər arasında A-nın payı */
  pAGivenNotB: Estimate | null;
  /** Asılı olmama fərziyyəsində gözlənilən P(A)·P(B) */
  independenceProduct: number | null;
}

export type IndependenceVerdict =
  | { kind: "insufficient"; minimumN: number }
  | { kind: "dependent" }
  | { kind: "inconclusive" };

export const EMPTY_COUNTS: EventCounts = Object.freeze({ aOnly: 0, bOnly: 0, both: 0, neither: 0 });

const Z_95 = 1.959964;

/**
 * Wilson etibarlılıq intervalı (95%).
 * Kiçik n və 0/1-ə yaxın paylarda Wald (normal yaxınlaşma) intervalından
 * əhəmiyyətli dərəcədə dəqiqdir - sinif auditoriyası (n ≈ 20-40) üçün məhz bu lazımdır.
 */
export function wilsonInterval(successes: number, trials: number, z: number = Z_95): Interval | null {
  if (!Number.isInteger(successes) || !Number.isInteger(trials)) return null;
  if (trials <= 0 || successes < 0 || successes > trials) return null;

  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denominator;

  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

function estimate(successes: number, trials: number): Estimate | null {
  const interval = wilsonInterval(successes, trials);
  return interval ? { value: successes / trials, interval } : null;
}

export function totalTrials(c: EventCounts): number {
  return c.aOnly + c.bOnly + c.both + c.neither;
}

export function computeStats(c: EventCounts): ExperimentStats {
  const n = totalTrials(c);
  const countA = c.aOnly + c.both;
  const countB = c.bOnly + c.both;
  const countNotB = c.aOnly + c.neither;

  const pA = estimate(countA, n);
  const pB = estimate(countB, n);

  return {
    n,
    pA,
    pB,
    pAB: estimate(c.both, n),
    pAGivenB: estimate(c.both, countB),
    pAGivenNotB: estimate(c.aOnly, countNotB),
    independenceProduct: pA && pB ? pA.value * pB.value : null,
  };
}

/**
 * Asılılığın sadə, lakin statistik cəhətdən dürüst yoxlanması:
 * P(A | B) və P(A | B̄) intervalları kəsişmirsə, asılılıq əlamətləri güclüdür.
 * Bu yanaşma konservativdir - kiçik n-də "aydın deyil" nəticəsi gözləniləndir.
 */
export function assessIndependence(stats: ExperimentStats, minimumN = 10): IndependenceVerdict {
  const { pAGivenB, pAGivenNotB } = stats;
  if (stats.n < minimumN || !pAGivenB || !pAGivenNotB) {
    return { kind: "insufficient", minimumN };
  }
  const overlap =
    pAGivenB.interval.lower <= pAGivenNotB.interval.upper &&
    pAGivenNotB.interval.lower <= pAGivenB.interval.upper;

  return overlap ? { kind: "inconclusive" } : { kind: "dependent" };
}

/** Azərbaycan formatı: onluq vergül. */
export function formatProbability(value: number, digits = 2): string {
  return value.toFixed(digits).replace(".", ",");
}
