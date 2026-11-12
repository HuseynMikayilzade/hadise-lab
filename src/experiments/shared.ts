import { wilsonInterval, type Estimate, type Interval } from "@/lib/probability";
import { betaFromCounts, betaMean, credibleInterval, type BetaPosterior } from "@/lib/engine/conjugate";
import { createHistory, recordHistory, type History } from "@/lib/engine/history";

/** Bir ehtimalın iki təxmini: tezlik (Wilson) və bayes (Beta posterior, 95% etibarlılıq intervalı). */
export interface DualEstimate {
  successes: number;
  trials: number;
  wilson: Estimate | null;
  posterior: BetaPosterior;
  bayes: Estimate;
}

export function dualEstimate(successes: number, trials: number): DualEstimate {
  const posterior = betaFromCounts(successes, trials - successes);
  const interval = wilsonInterval(successes, trials);
  return {
    successes,
    trials,
    wilson: interval ? { value: successes / trials, interval } : null,
    posterior,
    bayes: { value: betaMean(posterior), interval: credibleInterval(posterior) },
  };
}

/** Yaxınlaşma qrafiki üçün nöqtə: n, təxmin və Wilson intervalı. */
export interface ConvergencePoint {
  n: number;
  value: number;
  lower: number;
  upper: number;
}

export function convergencePoint(successes: number, trials: number): ConvergencePoint | null {
  const interval = wilsonInterval(successes, trials);
  return interval ? { n: trials, value: successes / trials, lower: interval.lower, upper: interval.upper } : null;
}

export function recordConvergence(history: History<ConvergencePoint>, successes: number, trials: number): void {
  const point = convergencePoint(successes, trials);
  if (point) recordHistory(history, point);
}

export { createHistory, recordHistory };
export type { History, Interval };

export const hashCount = (hash: Record<string, number>, field: string): number => hash[field] ?? 0;

export const sum = (values: readonly number[]): number => values.reduce((s, v) => s + v, 0);
