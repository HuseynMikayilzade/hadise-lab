"use client";

import { useEffect, useId, useRef } from "react";
import type { EventCounts } from "@/lib/probability";
import type { Cell } from "./definition";

export type Operation = "union" | "intersection" | "difference" | "complement" | "demorgan";

export const OPERATIONS: readonly { id: Operation; label: string; regions: readonly Cell[] }[] = [
  { id: "union", label: "A ∪ B", regions: ["aOnly", "both", "bOnly"] },
  { id: "intersection", label: "A ∩ B", regions: ["both"] },
  { id: "difference", label: "A \\ B", regions: ["aOnly"] },
  { id: "complement", label: "Ā", regions: ["bOnly", "neither"] },
  { id: "demorgan", label: "Ā ∩ B̄", regions: ["neither"] },
];

const W = 560;
const H = 330;
const A = { cx: 220, cy: 170, r: 122 };
const B = { cx: 340, cy: 170, r: 122 };

/** Sayı dəyişəndə bölgə bir dəfə qısa "parlayır" - yeni cavabın harada olduğunu göstərir. */
function RegionCount({ x, y, value, size, label, hideValue = false }: { x: number; y: number; value: number; size: number; label: string; hideValue?: boolean }) {
  const ref = useRef<SVGGElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (el && value > previous.current) {
      el.classList.remove("pulse");
      void el.getBoundingClientRect();
      el.classList.add("pulse");
    }
    previous.current = value;
  }, [value]);
  return (
    <g ref={ref} className="region-count">
      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={size} className="venn-count">
        {hideValue ? "" : value}
      </text>
      <text x={x} y={y + size * 0.72} textAnchor="middle" className="venn-region-label">
        {label}
      </text>
    </g>
  );
}

/** Canlı Venn diaqramı: dörd kəsişməyən bölgə (tam qrup) və seçilmiş əməliyyatın vurğulanması. */
export function VennDiagram({ counts, highlight, compact = false }: { counts: EventCounts; highlight: readonly Cell[]; compact?: boolean }) {
  const on = (cell: Cell) => (highlight.includes(cell) ? "region on" : "region");
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `${uid}-${name}`;
  return (
    <svg
      className={`venn ${compact ? "venn-compact" : ""}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Venn diaqramı: yalnız A ${counts.aOnly}, A və B ${counts.both}, yalnız B ${counts.bOnly}, heç biri ${counts.neither}`}
    >
      <defs>
        <mask id={id("mask-not-b")}>
          <rect width={W} height={H} fill="white" />
          <circle {...B} fill="black" />
        </mask>
        <mask id={id("mask-not-a")}>
          <rect width={W} height={H} fill="white" />
          <circle {...A} fill="black" />
        </mask>
        <mask id={id("mask-outside")}>
          <rect width={W} height={H} fill="white" />
          <circle {...A} fill="black" />
          <circle {...B} fill="black" />
        </mask>
        <clipPath id={id("clip-b")}>
          <circle {...B} />
        </clipPath>
      </defs>
      <rect className="omega" x="2" y="2" width={W - 4} height={H - 4} rx="14" />
      <rect className={on("neither")} x="2" y="2" width={W - 4} height={H - 4} rx="14" mask={`url(#${id("mask-outside")})`} />
      <circle className="set set-a" {...A} />
      <circle className="set set-b" {...B} />
      <circle className={on("aOnly")} {...A} mask={`url(#${id("mask-not-b")})`} />
      <circle className={on("bOnly")} {...B} mask={`url(#${id("mask-not-a")})`} />
      <circle className={on("both")} {...A} clipPath={`url(#${id("clip-b")})`} />
      <circle className="set-outline set-a" {...A} />
      <circle className="set-outline set-b" {...B} />

      <text className="omega-label" x="24" y="46">Ω</text>
      <text className="set-label" x="112" y="62">A</text>
      <text className="set-label" x="436" y="62">B</text>

      <RegionCount x={160} y={160} value={counts.aOnly} size={46} label="A \ B" hideValue={compact} />
      <RegionCount x={280} y={160} value={counts.both} size={50} label="A ∩ B" hideValue={compact} />
      <RegionCount x={400} y={160} value={counts.bOnly} size={46} label="B \ A" hideValue={compact} />
      <RegionCount x={500} y={262} value={counts.neither} size={34} label="Ā ∩ B̄" hideValue={compact} />
    </svg>
  );
}
