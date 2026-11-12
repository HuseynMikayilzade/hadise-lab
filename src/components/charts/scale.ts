export type Scale = (value: number) => number;

export function linearScale([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]): Scale {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

export function logScale([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]): Scale {
  const l0 = Math.log10(Math.max(d0, 1e-12));
  const l1 = Math.log10(Math.max(d1, 1e-12));
  const span = l1 - l0 || 1;
  return (v) => r0 + ((Math.log10(Math.max(v, 1e-12)) - l0) / span) * (r1 - r0);
}

/** 1-2-5 addımlı "gözəl" bölgülər. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (max <= min) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

export function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  for (let e = Math.ceil(Math.log10(Math.max(min, 1))); 10 ** e <= max; e += 1) ticks.push(10 ** e);
  return ticks;
}

/** Nöqtələrdən SVG xətti yolu. */
export function linePath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
}

/** Yuxarı və aşağı sərhədlərdən zolaq (interval band). */
export function bandPath(upper: readonly { x: number; y: number }[], lower: readonly { x: number; y: number }[]): string {
  if (upper.length === 0) return "";
  const back = [...lower].reverse();
  return `${linePath(upper)}${back.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("")}Z`;
}
