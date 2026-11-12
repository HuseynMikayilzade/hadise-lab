import type { RandomSource } from "./rng";

export function uniform(rng: RandomSource, min: number, max: number): number {
  return min + (max - min) * rng.next();
}

export function bernoulli(rng: RandomSource, p: number): boolean {
  return rng.next() < p;
}

/** Ehtimallar vektorundan indeks seçimi (cəmi 1-ə bərabər olmalıdır). */
export function categorical(rng: RandomSource, probabilities: readonly number[]): number {
  const u = rng.next();
  let cumulative = 0;
  for (let i = 0; i < probabilities.length; i += 1) {
    cumulative += probabilities[i];
    if (u < cumulative) return i;
  }
  return probabilities.length - 1;
}

/** Standart normal - Marsaglia polar üsulu. */
export function standardNormal(rng: RandomSource): number {
  for (;;) {
    const u = 2 * rng.next() - 1;
    const v = 2 * rng.next() - 1;
    const s = u * u + v * v;
    if (s > 0 && s < 1) return u * Math.sqrt((-2 * Math.log(s)) / s);
  }
}

/**
 * Gamma(shape, 1) - Marsaglia-Tsang üsulu (2000).
 * shape < 1 olduqda Gamma(shape + 1)·U^(1/shape) çevrilməsindən istifadə olunur.
 */
export function gamma(rng: RandomSource, shape: number): number {
  if (!(shape > 0)) throw new RangeError("shape must be positive");
  if (shape < 1) {
    const u = 1 - rng.next();
    return gamma(rng, shape + 1) * u ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = standardNormal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = 1 - rng.next();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function beta(rng: RandomSource, alpha: number, betaParam: number): number {
  const x = gamma(rng, alpha);
  const y = gamma(rng, betaParam);
  return x / (x + y);
}

export function dirichlet(rng: RandomSource, alphas: readonly number[]): number[] {
  const draws = alphas.map((a) => gamma(rng, a));
  const total = draws.reduce((sum, value) => sum + value, 0);
  return draws.map((value) => value / total);
}
