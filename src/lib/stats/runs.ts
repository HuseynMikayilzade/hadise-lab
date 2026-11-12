import type { RandomSource } from "@/lib/engine/rng";

export const SEQUENCE_LENGTH = 20;
export const SEQUENCE_PATTERN = /^[GR]{20}$/;

/** Ən uzun eyni simvollar seriyasının uzunluğu (məs. "GGGR" → 3). */
export function longestRun(sequence: string): number {
  if (sequence.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < sequence.length; i += 1) {
    current = sequence[i] === sequence[i - 1] ? current + 1 : 1;
    if (current > best) best = current;
  }
  return best;
}

/** Qonşu simvolların dəyişmə sayı (G→R və ya R→G). */
export function switchCount(sequence: string): number {
  let switches = 0;
  for (let i = 1; i < sequence.length; i += 1) if (sequence[i] !== sequence[i - 1]) switches += 1;
  return switches;
}

export function randomSequence(rng: RandomSource, length = SEQUENCE_LENGTH): string {
  let result = "";
  for (let i = 0; i < length; i += 1) result += rng.next() < 0.5 ? "G" : "R";
  return result;
}

/** Klassifikator üçün standartlaşdırılmış əlamətlər (təxmini miqyasla). */
export function sequenceFeatures(sequence: string): number[] {
  const g = [...sequence].filter((c) => c === "G").length;
  return [
    (longestRun(sequence) - 4.3) / 1.5,
    (switchCount(sequence) - 9.5) / 2.2,
    (Math.abs(2 * g - sequence.length) - 3.5) / 2.7,
  ];
}
