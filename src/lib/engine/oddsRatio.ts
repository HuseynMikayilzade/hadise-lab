import type { EventCounts, Interval } from "@/lib/probability";

export interface JointDistribution {
  /** P(A ∩ B), P(A ∩ B̄), P(Ā ∩ B), P(Ā ∩ B̄) */
  both: number;
  aOnly: number;
  bOnly: number;
  neither: number;
}

/**
 * Marjinallar P(A), P(B) və əmsallar nisbəti (odds ratio) ilə 2×2 birgə paylanma (Plackett).
 * OR = 1 olduqda A və B asılı deyil: P(A ∩ B) = P(A)·P(B).
 */
export function jointFromOddsRatio(pA: number, pB: number, oddsRatio: number): JointDistribution {
  let both: number;
  if (Math.abs(oddsRatio - 1) < 1e-12) {
    both = pA * pB;
  } else {
    const s = 1 + (pA + pB) * (oddsRatio - 1);
    const discriminant = s * s - 4 * oddsRatio * (oddsRatio - 1) * pA * pB;
    both = (s - Math.sqrt(discriminant)) / (2 * (oddsRatio - 1));
  }
  return { both, aOnly: pA - both, bOnly: pB - both, neither: 1 - pA - pB + both };
}

export interface OddsRatioEstimate {
  value: number;
  interval: Interval;
}

/**
 * Nümunə əmsallar nisbəti və Woolf (log) 95% intervalı.
 * Hər hansı xana sıfırdırsa, Haldane-Anscombe düzəlişi (+0,5) tətbiq olunur.
 */
export function estimateOddsRatio(c: EventCounts, z = 1.959964): OddsRatioEstimate | null {
  const cells = [c.both, c.aOnly, c.bOnly, c.neither];
  if (cells.reduce((s, v) => s + v, 0) < 4) return null;
  const correction = cells.some((v) => v === 0) ? 0.5 : 0;
  const [a, b, cc, d] = cells.map((v) => v + correction);
  const logOr = Math.log((a * d) / (b * cc));
  const se = Math.sqrt(1 / a + 1 / b + 1 / cc + 1 / d);
  return { value: Math.exp(logOr), interval: { lower: Math.exp(logOr - z * se), upper: Math.exp(logOr + z * se) } };
}
