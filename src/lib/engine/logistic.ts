/**
 * Kiçik onlayn logistik reqressiya (stoxastik qradiyent enişi).
 * Təcrübə 8-də "insan" və "təsadüfi" ardıcıllıqları ayırmaq üçün istifadə olunur.
 */
export interface LogisticModel {
  weights: number[];
  bias: number;
  learningRate: number;
  /** Prekvensial dəqiqlik: hər nümunə əvvəlcə proqnozlaşdırılır, sonra öyrədilir. */
  seen: number;
  correct: number;
}

export function createLogistic(features: number, learningRate = 0.05): LogisticModel {
  return { weights: new Array<number>(features).fill(0), bias: 0, learningRate, seen: 0, correct: 0 };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function predictProbability(model: LogisticModel, x: readonly number[]): number {
  let z = model.bias;
  for (let i = 0; i < x.length; i += 1) z += model.weights[i] * x[i];
  return sigmoid(z);
}

/** Əvvəl proqnoz (dəqiqlik sayılır), sonra bir SGD addımı. label: 1 = insan, 0 = təsadüfi. */
export function trainStep(model: LogisticModel, x: readonly number[], label: 0 | 1): void {
  const p = predictProbability(model, x);
  model.seen += 1;
  if ((p >= 0.5 ? 1 : 0) === label) model.correct += 1;
  const gradient = p - label;
  for (let i = 0; i < x.length; i += 1) model.weights[i] -= model.learningRate * gradient * x[i];
  model.bias -= model.learningRate * gradient;
}

export function accuracy(model: LogisticModel): number | null {
  return model.seen === 0 ? null : model.correct / model.seen;
}
