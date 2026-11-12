/** Diaqnostik test ssenarisi: xəstəlik yayılması, həssaslıq və yalançı müsbət nisbəti. */
export interface TestScenario {
  prevalence: number;
  sensitivity: number;
  falsePositiveRate: number;
}

export const DEFAULT_SCENARIO: TestScenario = Object.freeze({ prevalence: 0.01, sensitivity: 0.9, falsePositiveRate: 0.09 });

/** Tam ehtimal düsturu: P(+) = P(+ | X)·P(X) + P(+ | X̄)·P(X̄). */
export function probabilityPositive(s: TestScenario): number {
  return s.sensitivity * s.prevalence + s.falsePositiveRate * (1 - s.prevalence);
}

/** Bayes düsturu: P(X | +) = P(+ | X)·P(X) / P(+). */
export function posteriorGivenPositive(s: TestScenario): number {
  return (s.sensitivity * s.prevalence) / probabilityPositive(s);
}

/** Mənfi nəticədən sonra: P(X | −) = P(− | X)·P(X) / P(−). */
export function posteriorGivenNegative(s: TestScenario): number {
  const negativeIfIll = (1 - s.sensitivity) * s.prevalence;
  return negativeIfIll / (negativeIfIll + (1 - s.falsePositiveRate) * (1 - s.prevalence));
}

/** Ardıcıl testləmə: əvvəlki posterior növbəti testin prioru olur. */
export function updateAfterTest(prior: number, positive: boolean, s: TestScenario): number {
  return positive
    ? posteriorGivenPositive({ ...s, prevalence: prior })
    : posteriorGivenNegative({ ...s, prevalence: prior });
}

export interface NaturalFrequencies {
  population: number;
  ill: number;
  illPositive: number;
  healthy: number;
  healthyPositive: number;
  positive: number;
}

/** "1000 nəfərdən..." görünüşü - təbii tezliklər (Gigerenzer). */
export function naturalFrequencies(s: TestScenario, population = 1000): NaturalFrequencies {
  const ill = population * s.prevalence;
  const healthy = population - ill;
  const illPositive = ill * s.sensitivity;
  const healthyPositive = healthy * s.falsePositiveRate;
  return { population, ill, illPositive, healthy, healthyPositive, positive: illPositive + healthyPositive };
}
