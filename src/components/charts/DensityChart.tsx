"use client";

import { ChartFrame } from "./ChartFrame";
import { betaCurve, betaQuantile, type BetaPosterior } from "@/lib/engine/conjugate";
import { formatProbability } from "@/lib/format";
import { linearScale, linePath, niceTicks } from "./scale";

export interface DensityCurve {
  id: string;
  label: string;
  posterior: BetaPosterior;
  /** CSS rəng dəyişəni (məs. "var(--event-a)"). */
  color: string;
  dashed?: boolean;
}

const M = { top: 14, right: 16, bottom: 38, left: 16 };

/**
 * Beta posterior sıxlıq əyriləri. X oxu bütün əyrilərin 0,1%-99,9% kvantillərinə uyğun daralır,
 * beləcə öyrənmə irəlilədikcə əyrilər daralıb hündürləşir.
 */
function DensityChartSvg({
  width: W,
  height: H,
  curves,
  truths = [],
  ariaLabel,
  xFormat = (v) => formatProbability(v),
}: {
  width: number;
  height: number;
  curves: readonly DensityCurve[];
  truths?: readonly { id: string; value: number; label: string }[];
  ariaLabel: string;
  xFormat?: (v: number) => string;
}) {
  const lows = curves.map((c) => betaQuantile(0.001, c.posterior));
  const highs = curves.map((c) => betaQuantile(0.999, c.posterior));
  const truthValues = truths.map((t) => t.value);
  let lo = Math.min(...lows, ...truthValues);
  let hi = Math.max(...highs, ...truthValues);
  const pad = (hi - lo) * 0.08 || 0.05;
  lo = Math.max(0, lo - pad);
  hi = Math.min(1, hi + pad);

  const data = curves.map((c) => ({ curve: c, points: betaCurve(c.posterior, 140, { lower: lo, upper: hi }) }));
  const maxY = Math.max(1, ...data.flatMap((d) => d.points.map((p) => p.y)));
  const x = linearScale([lo, hi], [M.left, W - M.right]);
  const y = linearScale([0, maxY * 1.08], [H - M.bottom, M.top]);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
      <line className="axis" x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} />
      {niceTicks(lo, hi, 5).map((t) => (
        <text key={t} className="tick" x={x(t)} y={H - M.bottom + 18} textAnchor="middle">
          {xFormat(t)}
        </text>
      ))}
      {data.map(({ curve, points }) => {
        const line = points.map((p) => ({ x: x(p.x), y: y(p.y) }));
        const area = `${linePath(line)}L${x(hi).toFixed(1)},${y(0).toFixed(1)}L${x(lo).toFixed(1)},${y(0).toFixed(1)}Z`;
        return (
          <g key={curve.id} className="density" style={{ color: curve.color }}>
            <path className="density-area" d={area} />
            <path className={`density-line ${curve.dashed ? "dashed" : ""}`} d={linePath(line)} />
          </g>
        );
      })}
      {truths.map((t) => (
        <g key={t.id} className="truth-marker">
          <line x1={x(t.value)} x2={x(t.value)} y1={M.top} y2={H - M.bottom} />
          <text x={x(t.value)} y={M.top + 2} textAnchor="middle" dominantBaseline="hanging">
            {t.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Konteynerə uyğun ölçülən versiya. */
export function DensityChart(props: Omit<Parameters<typeof DensityChartSvg>[0], "width" | "height">) {
  return <ChartFrame>{(size) => <DensityChartSvg {...props} width={size.width} height={size.height} />}</ChartFrame>;
}
