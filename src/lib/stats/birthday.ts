import type { RandomSource } from "@/lib/engine/rng";

export const DAYS_IN_YEAR = 365;

/**
 * n nəfərlik qrupda ən azı iki nəfərin ad günü üst-üstə düşmə ehtimalı.
 * Əks hadisə ilə: P(A) = 1 - P(Ā) = 1 - Π_{i=0}^{n-1} (365 - i) / 365.
 */
export function birthdayMatchProbability(n: number, days = DAYS_IN_YEAR): number {
  if (n <= 1) return 0;
  if (n > days) return 1;
  let noMatch = 1;
  for (let i = 0; i < n; i += 1) noMatch *= (days - i) / days;
  return 1 - noMatch;
}

export function birthdayCurve(maxN: number): { n: number; p: number }[] {
  const points: { n: number; p: number }[] = [];
  for (let n = 1; n <= maxN; n += 1) points.push({ n, p: birthdayMatchProbability(n) });
  return points;
}

/** Bir təsadüfi qrup: n nəfərin ad günü bərabər paylanır; ən azı bir uyğunluq varmı? */
export function simulateGroupHasMatch(n: number, rng: RandomSource, days = DAYS_IN_YEAR): boolean {
  const seen = new Uint8Array(days);
  for (let i = 0; i < n; i += 1) {
    const day = rng.int(days);
    if (seen[day]) return true;
    seen[day] = 1;
  }
  return false;
}
