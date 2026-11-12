"use client";

import { ChartFrame } from "./ChartFrame";
import { formatInt } from "@/lib/format";
import { linearScale, linePath, logScale, logTicks, niceTicks } from "./scale";

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  points: readonly { n: number; value: number }[];
}

const M = { top: 14, right: 16, bottom: 40, left: 58 };

/** Bir neçə rəngli xətt (trafik payları, kumulyativ itki və s.). */
function LinesChartSvg({
  width: W,
  height: H,
  series,
  yDomain,
  yFormat,
  xLabel,
  ariaLabel,
  logX = false,
  logY = false,
  guides = [],
}: {
  width: number;
  height: number;
  series: readonly LineSeries[];
  yDomain: readonly [number, number];
  yFormat: (v: number) => string;
  xLabel: string;
  ariaLabel: string;
  logX?: boolean;
  logY?: boolean;
  guides?: readonly { value: number; label: string }[];
}) {
  const maxN = Math.max(10, ...series.flatMap((s) => s.points.map((p) => p.n)));
  const x = (logX ? logScale : linearScale)([1, maxN], [M.left, W - M.right]);
  const y = (logY ? logScale : linearScale)(yDomain, [H - M.bottom, M.top]);
  const clamp = (v: number) => Math.min(Math.max(v, yDomain[0]), yDomain[1]);
  const yTicks = logY ? logTicks(yDomain[0], yDomain[1]).concat(yDomain[0] < 1 ? [0.001, 0.01, 0.1].filter((t) => t >= yDomain[0] && t <= yDomain[1]) : []) : niceTicks(yDomain[0], yDomain[1], 4);
  const xTicks = logX ? logTicks(1, maxN) : niceTicks(0, maxN, 5);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
      {[...new Set(yTicks)].map((t) => (
        <g key={t}>
          <line className="grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
          <text className="tick" x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
            {yFormat(t)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={t} className="tick" x={x(Math.max(1, t))} y={H - M.bottom + 18} textAnchor="middle">
          {formatInt(t)}
        </text>
      ))}
      <text className="axis-label" x={(M.left + W - M.right) / 2} y={H - 4} textAnchor="middle">
        {xLabel}
      </text>
      {guides.map((g) => (
        <g key={g.label} className="ref ref-reference">
          <line x1={M.left} x2={W - M.right} y1={y(clamp(g.value))} y2={y(clamp(g.value))} />
        </g>
      ))}
      {series.map((s) => (
        <path
          key={s.id}
          className={`multi-line ${s.dashed ? "dashed" : ""}`}
          style={{ stroke: s.color }}
          d={linePath(s.points.filter((p) => p.n >= 1).map((p) => ({ x: x(p.n), y: y(clamp(p.value)) })))}
        />
      ))}
    </svg>
  );
}

/** Konteynerə uyğun ölçülən versiya. */
export function LinesChart(props: Omit<Parameters<typeof LinesChartSvg>[0], "width" | "height">) {
  return <ChartFrame>{(size) => <LinesChartSvg {...props} width={size.width} height={size.height} />}</ChartFrame>;
}
