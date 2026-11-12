import { insideCircle, type Point } from "@/lib/stats/montecarlo";

/** Vahid kvadrat və daxilə çəkilmiş dairə; nöqtələr daxildə/xaricdə fərqli rəng və formada. */
export function PointSquare({ points, highlight = [], size = 600 }: { points: readonly Point[]; highlight?: readonly Point[]; size?: number }) {
  const s = (v: number) => 10 + v * (size - 20);
  return (
    <svg className="point-square" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Kvadratda ${points.length} nöqtə, dairə daxilində ${points.filter(insideCircle).length}`}>
      <rect className="square" x="10" y="10" width={size - 20} height={size - 20} />
      <circle className="circle" cx={size / 2} cy={size / 2} r={(size - 20) / 2} />
      {points.map((p, i) =>
        insideCircle(p) ? (
          <circle key={i} className="pt pt-in" cx={s(p.x)} cy={s(p.y)} r={3} />
        ) : (
          <rect key={i} className="pt pt-out" x={s(p.x) - 2.5} y={s(p.y) - 2.5} width={5} height={5} />
        ),
      )}
      {highlight.map((p, i) => (
        <circle key={`h${i}`} className="pt-mine" cx={s(p.x)} cy={s(p.y)} r={5} />
      ))}
    </svg>
  );
}
