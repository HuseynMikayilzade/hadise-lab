"use client";

import { ChartFrame } from "./ChartFrame";
import { formatInt, formatProbability } from "@/lib/format";
import { bandPath, linearScale, linePath, logScale, logTicks, niceTicks } from "./scale";

export type SeriesKind = "audience" | "sim";

export interface ConvergenceSeries {
  id: string;
  label: string;
  kind: SeriesKind;
  points: readonly { n: number; value: number; lower?: number; upper?: number }[];
}

export interface ReferenceLine {
  value: number;
  label: string;
  kind: "reference" | "truth";
}

/** 10-un qüvvətləri (kəsr də ola bilər): log oxu üçün. */
function decadeTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  for (let e = Math.ceil(Math.log10(min)); 10 ** e <= max * (1 + 1e-9); e += 1) ticks.push(10 ** e);
  return ticks;
}

const M = { top: 16, right: 92, bottom: 40, left: 58 };

/**
 * Yaxınlaşma qrafiki: n artdıqca təxmin və onun intervalı. Auditoriya - bütöv xətt və dairə,
 * simulyasiya - qırıq xətt və kvadrat (yalnız rəng ilə fərqləndirilmir).
 */
function ConvergenceChartSvg({
  width: W,
  height: H,
  series,
  refs = [],
  yDomain,
  logX = false,
  logY = false,
  yFormat = (v) => formatProbability(v),
  xLabel = "sınaqların sayı n",
  ariaLabel,
}: {
  width: number;
  height: number;
  series: readonly ConvergenceSeries[];
  refs?: readonly ReferenceLine[];
  yDomain: readonly [number, number];
  logX?: boolean;
  logY?: boolean;
  yFormat?: (v: number) => string;
  xLabel?: string;
  ariaLabel: string;
}) {
  const maxN = Math.max(10, ...series.flatMap((s) => s.points.map((p) => p.n)));
  const x = (logX ? logScale : linearScale)([1, maxN], [M.left, W - M.right]);
  const y = (logY ? logScale : linearScale)(yDomain, [H - M.bottom, M.top]);
  const clampY = (v: number) => Math.min(Math.max(v, yDomain[0]), yDomain[1]);
  const xTicks = logX ? logTicks(1, maxN) : niceTicks(0, maxN, 5).filter((t) => t >= 1 || t === 0);
  const yTicks = logY ? decadeTicks(yDomain[0], yDomain[1]) : niceTicks(yDomain[0], yDomain[1], 4);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line className="grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
          <text className="tick" x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
            {yFormat(t)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x${t}`} className="tick" x={x(Math.max(t, 1))} y={H - M.bottom + 18} textAnchor="middle">
          {formatInt(t)}
        </text>
      ))}
      <text className="axis-label" x={(M.left + W - M.right) / 2} y={H - 4} textAnchor="middle">
        {xLabel}
      </text>

      {refs.map((r) => (
        <g key={`${r.kind}${r.label}`} className={`ref ref-${r.kind}`}>
          <line x1={M.left} x2={W - M.right} y1={y(clampY(r.value))} y2={y(clampY(r.value))} />
          <text x={W - M.right + 14} y={y(clampY(r.value))} dominantBaseline="middle">
            {r.label}
          </text>
        </g>
      ))}

      {series.map((s) => {
        const pts = s.points.filter((p) => p.n >= 1);
        const line = pts.map((p) => ({ x: x(p.n), y: y(clampY(p.value)) }));
        const hasBand = pts.length > 1 && pts.every((p) => p.lower !== undefined && p.upper !== undefined);
        const last = line[line.length - 1];
        return (
          <g key={s.id} className={`series series-${s.kind}`}>
            {hasBand && (
              <path
                className="band"
                d={bandPath(
                  pts.map((p) => ({ x: x(p.n), y: y(clampY(p.upper!)) })),
                  pts.map((p) => ({ x: x(p.n), y: y(clampY(p.lower!)) })),
                )}
              />
            )}
            <path className="line" d={linePath(line)} />
            {last &&
              (s.kind === "audience" ? (
                <circle className="marker" cx={last.x} cy={last.y} r={6} />
              ) : (
                <rect className="marker" x={last.x - 5.5} y={last.y - 5.5} width={11} height={11} />
              ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Konteynerə uyğun ölçülən versiya. */
export function ConvergenceChart(props: Omit<Parameters<typeof ConvergenceChartSvg>[0], "width" | "height">) {
  return <ChartFrame>{(size) => <ConvergenceChartSvg {...props} width={size.width} height={size.height} />}</ChartFrame>;
}
