import type { Interval } from "@/lib/probability";
import { logBeta, regularizedBeta } from "./special";

/** Beta(α, β) posterior - Bernoulli müşahidələri üçün qoşma (conjugate) prior. */
export interface BetaPosterior {
  alpha: number;
  beta: number;
}

/** Bərabər (uniform) prior Beta(1, 1). */
export const UNIFORM_BETA: BetaPosterior = Object.freeze({ alpha: 1, beta: 1 });

export function betaFromCounts(successes: number, failures: number, prior: BetaPosterior = UNIFORM_BETA): BetaPosterior {
  return { alpha: prior.alpha + successes, beta: prior.beta + failures };
}

export function betaMean({ alpha, beta }: BetaPosterior): number {
  return alpha / (alpha + beta);
}

export function betaVariance({ alpha, beta }: BetaPosterior): number {
  const s = alpha + beta;
  return (alpha * beta) / (s * s * (s + 1));
}

export function betaPdf(x: number, { alpha, beta }: BetaPosterior): number {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logBeta(alpha, beta));
}

export function betaCdf(x: number, { alpha, beta }: BetaPosterior): number {
  return regularizedBeta(x, alpha, beta);
}

/** Beta paylanmasının kvantili - CDF monoton olduğundan ikiyə bölmə (bisection) etibarlıdır. */
export function betaQuantile(q: number, posterior: BetaPosterior): number {
  if (q <= 0) return 0;
  if (q >= 1) return 1;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (betaCdf(mid, posterior) < q) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Bərabər quyruqlu (equal-tailed) bayes etibarlılıq intervalı. */
export function credibleInterval(posterior: BetaPosterior, level = 0.95): Interval {
  const tail = (1 - level) / 2;
  return { lower: betaQuantile(tail, posterior), upper: betaQuantile(1 - tail, posterior) };
}

/** Dirichlet-Multinomial: α_i = prior_i + n_i. */
export function dirichletFromCounts(counts: readonly number[], prior = 1): number[] {
  return counts.map((count) => count + prior);
}

/** Dirichlet-in i-ci komponentinin marjinal paylanması Beta(α_i, Σα - α_i)-dır. */
export function dirichletMarginal(alphas: readonly number[], index: number): BetaPosterior {
  const total = alphas.reduce((sum, a) => sum + a, 0);
  return { alpha: alphas[index], beta: total - alphas[index] };
}

/** Sıxlıq əyrisini çəkmək üçün nöqtələr; kəskin posteriorlarda pəncərəni daraldır. */
export function betaCurve(posterior: BetaPosterior, points = 120, range?: Interval): { x: number; y: number }[] {
  const lower = range?.lower ?? 0;
  const upper = range?.upper ?? 1;
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i <= points; i += 1) {
    const x = lower + ((upper - lower) * i) / points;
    result.push({ x, y: betaPdf(Math.min(Math.max(x, 1e-9), 1 - 1e-9), posterior) });
  }
  return result;
}
