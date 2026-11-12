import type { RandomSource } from "./rng";
import { beta } from "./samplers";

export interface ArmState {
  shows: number;
  clicks: number;
}

/** Hər variant üçün Beta(1 + klik, 1 + keçid) posteriorundan bir nümunə çəkib ən böyüyünü seçir. */
export function thompsonChoose(arms: readonly ArmState[], rng: RandomSource): number {
  let best = 0;
  let bestDraw = -1;
  for (let i = 0; i < arms.length; i += 1) {
    const draw = beta(rng, 1 + arms[i].clicks, 1 + arms[i].shows - arms[i].clicks);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = i;
    }
  }
  return best;
}

/** Bərabər bölgü: ziyarətçilər variantlara növbə ilə (1/3 pay) göndərilir. */
export function equalSplitChoose(visitorIndex: number, armCount: number): number {
  return visitorIndex % armCount;
}

/** Bir ziyarətçinin gözlənilən itkisi (regret): ən yaxşı variantın ehtimalı - seçilən variantın ehtimalı. */
export function instantRegret(trueRates: readonly number[], chosen: number): number {
  return Math.max(...trueRates) - trueRates[chosen];
}

export interface BanditComparison {
  thompsonRegret: number;
  splitRegret: number;
  thompsonShows: number[];
}

/** Eyni gizli ehtimallar üzərində Thompson və bərabər bölgünü yan-yana işlədir (testlər üçün). */
export function compareBandits(trueRates: readonly number[], visitors: number, rng: RandomSource): BanditComparison {
  const arms: ArmState[] = trueRates.map(() => ({ shows: 0, clicks: 0 }));
  let thompsonRegret = 0;
  let splitRegret = 0;
  for (let v = 0; v < visitors; v += 1) {
    const t = thompsonChoose(arms, rng);
    arms[t].shows += 1;
    if (rng.next() < trueRates[t]) arms[t].clicks += 1;
    thompsonRegret += instantRegret(trueRates, t);
    splitRegret += instantRegret(trueRates, equalSplitChoose(v, trueRates.length));
  }
  return { thompsonRegret, splitRegret, thompsonShows: arms.map((a) => a.shows) };
}
