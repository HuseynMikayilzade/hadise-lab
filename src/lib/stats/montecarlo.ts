import { wilsonInterval, type Estimate } from "@/lib/probability";
import type { RandomSource } from "@/lib/engine/rng";

export interface Point {
  x: number;
  y: number;
}

/** Vahid kvadratda bərabər paylanmış nöqtə. Dairə mərkəzi (0,5; 0,5), radiusu 0,5. */
export function randomPoint(rng: RandomSource): Point {
  return { x: rng.next(), y: rng.next() };
}

export function insideCircle({ x, y }: Point): boolean {
  const dx = x - 0.5;
  const dy = y - 0.5;
  return dx * dx + dy * dy <= 0.25;
}

/** π = 4·P(dairədə); interval Wilson intervalının 4-ə vurulması ilə alınır. */
export function estimatePi(inside: number, total: number): Estimate | null {
  const interval = wilsonInterval(inside, total);
  if (!interval) return null;
  return { value: (4 * inside) / total, interval: { lower: 4 * interval.lower, upper: 4 * interval.upper } };
}

/** Nöqtəni yığcam sətrə çevirir (Redis siyahısı üçün): "x,y" 4 rəqəm dəqiqliyi ilə. */
export function encodePoint({ x, y }: Point): string {
  return `${x.toFixed(4)},${y.toFixed(4)}`;
}

export function decodePoint(raw: string): Point | null {
  const [xs, ys] = raw.split(",");
  const x = Number(xs);
  const y = Number(ys);
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}
