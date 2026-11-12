import { formatProbability, type Interval } from "@/lib/probability";

export { formatProbability };

/** Tam ədəd minliklər ayırıcısı ilə: 12 345. */
export function formatInt(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Faiz onluq vergüllə: 9,2%. */
export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits).replace(".", ",")}%`;
}

export function formatInterval(interval: Interval, digits = 2): string {
  return `[${formatProbability(interval.lower, digits)}; ${formatProbability(interval.upper, digits)}]`;
}

/** Ümumi onluq ədəd (π təxmini və s.). */
export function formatDecimal(value: number, digits = 3): string {
  return value.toFixed(digits).replace(".", ",");
}
