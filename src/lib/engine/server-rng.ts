import { randomInt } from "node:crypto";
import type { RandomSource } from "./rng";

// randomInt tələb edir: max - min < 2^48.
const RANGE = 2 ** 47;

/** Server tərəfində auditoriya üçün təsadüfilik (zər atışı, Monte Karlo nöqtələri): crypto.randomInt. */
export const serverRng: RandomSource = {
  next: () => randomInt(RANGE) / RANGE,
  int: (maxExclusive) => randomInt(maxExclusive),
  seed: null,
};
