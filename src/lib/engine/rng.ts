/**
 * Təsadüfi ədəd mənbəyi. İstehsalda kriptoqrafik mənbə istifadə olunur;
 * toxumlu (seeded) generator yalnız "Məşq" rejimi və testlər üçündür.
 */
export interface RandomSource {
  /** [0, 1) aralığında bərabər paylanmış ədəd. */
  next(): number;
  /** {0, 1, ..., maxExclusive - 1} çoxluğundan bərabər seçim. */
  int(maxExclusive: number): number;
  readonly seed: number | null;
}

const TWO_POW_32 = 0x1_0000_0000;
const TWO_POW_53 = 2 ** 53;

function intFromUnit(rng: () => number, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new RangeError("maxExclusive must be a positive integer");
  return Math.floor(rng() * maxExclusive);
}

/** crypto.getRandomValues üzərində buferlənmiş mənbə (brauzer, Web Worker və Node 20+). */
export function cryptoRng(bufferSize = 2048): RandomSource {
  const buffer = new Uint32Array(bufferSize);
  let index = bufferSize;
  const nextU32 = (): number => {
    if (index >= bufferSize) {
      globalThis.crypto.getRandomValues(buffer);
      index = 0;
    }
    const value = buffer[index];
    index += 1;
    return value;
  };
  // 53 bitlik dəqiqlik: 21 + 32 bit.
  const next = () => ((nextU32() >>> 11) * TWO_POW_32 + nextU32()) / TWO_POW_53;
  return { next, int: (max) => intFromUnit(next, max), seed: null };
}

/** sfc32 - sürətli, keyfiyyətli toxumlu generator. Yalnız məşq və testlər üçün. */
export function seededRng(seed: number): RandomSource {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed >>> 0;
  const step = (): number => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 15; i += 1) step();
  const next = () => step() / TWO_POW_32;
  return { next, int: (max) => intFromUnit(next, max), seed: seed >>> 0 };
}
