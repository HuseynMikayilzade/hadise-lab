const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

/** Zərin üzü (SVG). */
export function DieFace({ value, size = 120, rolling = false }: { value: number; size?: number; rolling?: boolean }) {
  return (
    <svg className={`die ${rolling ? "rolling" : ""}`} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Zər: ${value} xal`}>
      <rect x="4" y="4" width="92" height="92" rx="18" className="die-body" />
      {PIPS[value]?.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8.5" className="die-pip" />)}
    </svg>
  );
}
