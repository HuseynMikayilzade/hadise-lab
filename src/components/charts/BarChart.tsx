"use client";

import { useId, type CSSProperties } from "react";
import { ChartFrame } from "./ChartFrame";
import type { Interval } from "@/lib/probability";
import { linearScale, niceTicks } from "./scale";

export interface Bar {
  id: string;
  label: string;
  value: number;
  interval?: Interval | null;
  /** CSS rəngi. */
  color: string;
  /** Simulyasiya seriyası üçün ştrixli doldurma (rəngdən əlavə fərq). */
  hatched?: boolean;
  highlight?: boolean;
}

const M = { top: 30, right: 12, bottom: 44, left: 52 };

/**
 * Sütun diaqramı; istəyə görə hər sütun üçün interval (bığ) və gözlənilən dəyər işarəsi.
 * Bir kateqoriyada bir neçə seriya varsa, `groups` ilə yan-yana çəkilir.
 */
function BarChartSvg({
  width: W,
  height: H,
  groups,
  yMax,
  yFormat,
  valueFormat,
  expected,
  expectedLabel,
  ariaLabel,
  truth,
}: {
  width: number;
  height: number;
  groups: readonly { id: string; label: string; bars: readonly Bar[] }[];
  yMax: number;
  yFormat: (v: number) => string;
  valueFormat?: (v: number) => string;
  expected?: readonly (number | null)[];
  expectedLabel?: string;
  truth?: readonly (number | null)[];
  ariaLabel: string;
}) {
  const hatchId = `hatch${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const y = linearScale([0, yMax], [H - M.bottom, M.top]);
  const slot = (W - M.left - M.right) / Math.max(groups.length, 1);
  const inner = slot * 0.72;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
      <defs>
        {/* Ağ zolaqlar bar rənginin üzərinə çəkilir: simulyasiya seriyası rəngdən əlavə naxışla fərqlənir. */}
        <pattern id={hatchId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#ffffff" strokeWidth="3" strokeOpacity="0.85" />
        </pattern>
      </defs>
      {niceTicks(0, yMax, 4).map((t) => (
        <g key={t}>
          <line className="grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
          <text className="tick" x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
            {yFormat(t)}
          </text>
        </g>
      ))}
      {groups.map((group, gi) => {
        const x0 = M.left + gi * slot + (slot - inner) / 2;
        const barWidth = inner / Math.max(group.bars.length, 1);
        const exp = expected?.[gi];
        const tr = truth?.[gi];
        return (
          <g key={group.id}>
            {group.bars.map((bar, bi) => {
              const bx = x0 + bi * barWidth + 2;
              const bw = barWidth - 4;
              const top = y(Math.min(bar.value, yMax));
              return (
                <g key={bar.id} className={`bar ${bar.highlight ? "bar-highlight" : ""}`} style={{ color: bar.color }}>
                  <rect className="bar-rect" x={bx} width={bw} style={{ y: top, height: Math.max(0, y(0) - top) } as CSSProperties} fill="currentColor" rx={4} />
                  {bar.hatched && (
                    <rect className="bar-rect" x={bx} width={bw} style={{ y: top, height: Math.max(0, y(0) - top) } as CSSProperties} fill={`url(#${hatchId})`} rx={4} />
                  )}
                  {bar.interval && (
                    <g className="whisker">
                      <line x1={bx + bw / 2} x2={bx + bw / 2} y1={y(Math.min(bar.interval.upper, yMax))} y2={y(bar.interval.lower)} />
                      <line x1={bx + bw / 2 - 6} x2={bx + bw / 2 + 6} y1={y(Math.min(bar.interval.upper, yMax))} y2={y(Math.min(bar.interval.upper, yMax))} />
                      <line x1={bx + bw / 2 - 6} x2={bx + bw / 2 + 6} y1={y(bar.interval.lower)} y2={y(bar.interval.lower)} />
                    </g>
                  )}
                  {valueFormat && (
                    <text
                      className="bar-value"
                      x={bar.interval ? bx + bw / 2 + 10 : bx + bw / 2}
                      y={bar.interval ? top - 6 : top - 8}
                      textAnchor={bar.interval ? "start" : "middle"}
                    >
                      {valueFormat(bar.value)}
                    </text>
                  )}
                </g>
              );
            })}
            {exp !== undefined && exp !== null && (
              <line className="expected" x1={x0 - 4} x2={x0 + inner + 4} y1={y(exp)} y2={y(exp)}>
                <title>{expectedLabel}</title>
              </line>
            )}
            {tr !== undefined && tr !== null && <line className="truth-line" x1={x0 - 4} x2={x0 + inner + 4} y1={y(tr)} y2={y(tr)} />}
            <text className={`bar-label ${group.bars.some((b) => b.highlight) ? "bar-label-correct" : ""}`} x={x0 + inner / 2} y={H - M.bottom + 22} textAnchor="middle">
              {group.label}
            </text>
          </g>
        );
      })}
      <line className="axis" x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} />
    </svg>
  );
}

/** Konteynerə uyğun ölçülən versiya. */
export function BarChart(props: Omit<Parameters<typeof BarChartSvg>[0], "width" | "height">) {
  return <ChartFrame>{(size) => <BarChartSvg {...props} width={size.width} height={size.height} />}</ChartFrame>;
}
