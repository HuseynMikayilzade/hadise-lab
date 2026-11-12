import { formatDecimal, formatInt, formatPercent } from "@/lib/format";
import type { NaturalFrequencies, TestScenario } from "@/lib/stats/bayes";

const fmt = (v: number) => (Number.isInteger(v) ? formatInt(v) : formatDecimal(v, 1));

/** Təbii tezliklər ağacı: "1000 nəfərdən..." - Bayes düsturunun addım-addım izahı. */
export function FrequencyTree({ f, scenario }: { f: NaturalFrequencies; scenario: TestScenario }) {
  const nodes = [
    { x: 300, y: 36, text: `${fmt(f.population)} nəfər`, cls: "node-root" },
    { x: 150, y: 128, text: `${fmt(f.ill)} xəstə`, cls: "node-ill" },
    { x: 450, y: 128, text: `${fmt(f.healthy)} sağlam`, cls: "node-healthy" },
    { x: 80, y: 222, text: `${fmt(f.illPositive)} müsbət`, cls: "node-pos-ill" },
    { x: 220, y: 222, text: `${fmt(f.ill - f.illPositive)} mənfi`, cls: "node-neg" },
    { x: 380, y: 222, text: `${fmt(f.healthyPositive)} müsbət`, cls: "node-pos-healthy" },
    { x: 520, y: 222, text: `${fmt(f.healthy - f.healthyPositive)} mənfi`, cls: "node-neg" },
  ];
  const edges: [number, number, string][] = [
    [0, 1, formatPercent(scenario.prevalence, 0)],
    [0, 2, formatPercent(1 - scenario.prevalence, 0)],
    [1, 3, formatPercent(scenario.sensitivity, 0)],
    [1, 4, formatPercent(1 - scenario.sensitivity, 0)],
    [2, 5, formatPercent(scenario.falsePositiveRate, 0)],
    [2, 6, formatPercent(1 - scenario.falsePositiveRate, 0)],
  ];
  return (
    <svg className="tree" viewBox="0 0 600 260" role="img" aria-label={`1000 nəfərdən ${fmt(f.positive)} nəfərin testi müsbətdir, onlardan yalnız ${fmt(f.illPositive)} nəfəri xəstədir`}>
      {edges.map(([a, b, label]) => (
        <g key={`${a}-${b}`} className="tree-edge">
          <line x1={nodes[a].x} y1={nodes[a].y + 16} x2={nodes[b].x} y2={nodes[b].y - 18} />
          <text x={(nodes[a].x + nodes[b].x) / 2 + (nodes[b].x < nodes[a].x ? -12 : 12)} y={(nodes[a].y + nodes[b].y) / 2} textAnchor={nodes[b].x < nodes[a].x ? "end" : "start"}>
            {label}
          </text>
        </g>
      ))}
      {nodes.map((n) => (
        <g key={`${n.x}-${n.y}`} className={`tree-node ${n.cls}`}>
          <rect x={n.x - 64} y={n.y - 18} width="128" height="36" rx="10" />
          <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle">
            {n.text}
          </text>
        </g>
      ))}
    </svg>
  );
}
