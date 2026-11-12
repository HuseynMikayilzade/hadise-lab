import { regularizedGammaP } from "./special";

export const MIN_EXPECTED_COUNT = 5;

export type ChiSquareResult =
  | { kind: "insufficient"; minN: number }
  | { kind: "ok"; statistic: number; df: number; pValue: number; reject: boolean };

/** χ² paylanmasının sağ quyruq ehtimalı: P(X ≥ x), df sərbəstlik dərəcəsi ilə. */
export function chiSquareSurvival(x: number, df: number): number {
  if (x <= 0) return 1;
  return Math.max(0, 1 - regularizedGammaP(df / 2, x / 2));
}

/** Hər gözlənilən say ≥ 5 olması üçün lazım olan minimal n. */
export function minimumTrialsForChiSquare(expected: readonly number[]): number {
  const smallest = Math.min(...expected);
  return Math.ceil(MIN_EXPECTED_COUNT / smallest - 1e-9);
}

/**
 * Pirson χ² uyğunluq testi. Hökm yalnız bütün gözlənilən saylar ≥ 5 olduqda verilir -
 * əks halda χ² yaxınlaşması etibarsızdır.
 */
export function chiSquareGof(observed: readonly number[], expected: readonly number[], alpha = 0.05): ChiSquareResult {
  const n = observed.reduce((sum, value) => sum + value, 0);
  const minN = minimumTrialsForChiSquare(expected);
  if (n === 0 || expected.some((p) => p * n < MIN_EXPECTED_COUNT)) return { kind: "insufficient", minN };

  let statistic = 0;
  for (let i = 0; i < observed.length; i += 1) {
    const e = expected[i] * n;
    statistic += ((observed[i] - e) * (observed[i] - e)) / e;
  }
  const df = observed.length - 1;
  const pValue = chiSquareSurvival(statistic, df);
  return { kind: "ok", statistic, df, pValue, reject: pValue < alpha };
}
