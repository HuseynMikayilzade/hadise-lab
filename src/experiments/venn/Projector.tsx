"use client";

import { useState } from "react";
import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { BarChart, type Bar } from "@/components/charts/BarChart";
import { Legend } from "@/components/charts/Legend";
import { KeyNumber, Segmented, Stage } from "@/components/projector/Stage";
import { formatDecimal, formatInt, formatProbability } from "@/lib/format";
import type { EventCounts } from "@/lib/probability";
import type { ProjectorProps } from "../ui-types";
import { VENN_EVENTS, type VennSummary, type VennView } from "./definition";
import { OPERATIONS, VennDiagram, type Operation } from "./VennDiagram";

const total = (c: EventCounts) => c.aOnly + c.bOnly + c.both + c.neither;

/** Seçilmiş əməliyyat üçün say, ehtimal və canlı yoxlanan eynilik. */
function operationFacts(op: Operation, c: EventCounts) {
  const n = total(c);
  const p = (m: number) => (n > 0 ? m / n : 0);
  const pA = p(c.aOnly + c.both);
  const pB = p(c.bOnly + c.both);
  const pAB = p(c.both);
  const f = (v: number) => formatProbability(v);
  switch (op) {
    case "union": {
      const m = c.aOnly + c.both + c.bOnly;
      return { m, symbol: "P(A ∪ B)", identity: `P(A) + P(B) - P(A ∩ B) = ${f(pA)} + ${f(pB)} - ${f(pAB)} = ${f(pA + pB - pAB)}` };
    }
    case "intersection":
      return { m: c.both, symbol: "P(A ∩ B)", identity: `Müqayisə: P(A)·P(B) = ${f(pA)}·${f(pB)} = ${f(pA * pB)}` };
    case "difference":
      return { m: c.aOnly, symbol: "P(A \\ B)", identity: `P(A) - P(A ∩ B) = ${f(pA)} - ${f(pAB)} = ${f(pA - pAB)}` };
    case "complement":
      return { m: c.bOnly + c.neither, symbol: "P(Ā)", identity: `1 - P(A) = 1 - ${f(pA)} = ${f(1 - pA)}` };
    case "demorgan": {
      const union = p(c.aOnly + c.both + c.bOnly);
      return { m: c.neither, symbol: "P(Ā ∩ B̄)", identity: `De Morqan: 1 - P(A ∪ B) = 1 - ${f(union)} = ${f(1 - union)}` };
    }
  }
}

function conditionalBars(view: VennView, kind: "audience" | "sim"): { b: Bar; notB: Bar } {
  const color = kind === "audience" ? "var(--series-audience)" : "var(--series-sim)";
  return {
    b: { id: `${kind}-b`, label: kind, value: view.aGivenB.wilson?.value ?? 0, interval: view.aGivenB.wilson?.interval, color, hatched: kind === "sim" },
    notB: { id: `${kind}-nb`, label: kind, value: view.aGivenNotB.wilson?.value ?? 0, interval: view.aGivenNotB.wilson?.interval, color, hatched: kind === "sim" },
  };
}

function verdictText(view: VennView): string {
  const v = view.verdict;
  if (v.kind === "insufficient") return `Asılılıq haqqında nəticə üçün ən azı ${v.minimumN} cavab və hər iki qrupda (B və B̄) iştirakçı lazımdır.`;
  if (v.kind === "dependent") return "P(A | B) və P(A | B̄) intervalları kəsişmir: hadisələrin asılılığına dair güclü əlamət var.";
  return "Fərq bu n üçün statistik baxımdan aydın deyil: asılılıq haqqında qəti nəticə çıxarmaq olmaz.";
}

export function VennProjector({ audience, sim, mode, fast }: ProjectorProps<VennView, VennSummary>) {
  const [op, setOp] = useState<Operation>("union");
  const simView = sim?.view ?? null;
  const main = mode === "auto" ? simView : audience;
  const counts = main?.counts ?? { aOnly: 0, bOnly: 0, both: 0, neither: 0 };
  const n = total(counts);
  const facts = operationFacts(op, counts);
  const region = OPERATIONS.find((o) => o.id === op)!;
  const truth = sim?.truth ?? null;

  const series = [audience && mode !== "auto" ? conditionalBars(audience, "audience") : null, simView && mode !== "audience" ? conditionalBars(simView, "sim") : null].filter(
    (s): s is { b: Bar; notB: Bar } => s !== null,
  );

  let takeaway: string | null = n >= 10 ? verdictText(main!) : null;
  if (truth && simView) {
    const or = simView.oddsRatio;
    takeaway = `Gizli həqiqət: ${truth.independent ? "A və B asılı deyildi (OR = 1)" : `A və B asılı idi (OR = ${formatDecimal(truth.oddsRatio, 2)})`}. ${formatInt(total(simView.counts))} sınaqdan sonra öyrənilən OR = ${or ? formatDecimal(or.value, 2) : "-"}.`;
  }

  return (
    <Stage
      instruction={`A - ${VENN_EVENTS.a.short}, B - ${VENN_EVENTS.b.short}`}
      toolbar={<Segmented label="Əməliyyat" options={OPERATIONS} value={op} onChange={setOp} />}
      hero={<VennDiagram counts={counts} highlight={region.regions} />}
      side={
        <>
          <div className="key-row">
            <KeyNumber label="sınaq (n)">
              <AnimatedNumber value={n} format={formatInt} fast={fast} />
            </KeyNumber>
            <KeyNumber label={<span className="math">{facts.symbol}</span>} tone="truth" detail={`${facts.m} / ${n}`}>
              <AnimatedNumber value={n > 0 ? facts.m / n : null} format={(v) => formatProbability(v)} fast={fast} />
            </KeyNumber>
          </div>
          <p className="identity math">{facts.identity}</p>
          <div className="mini-chart">
            <p className="chart-title math">P(A | B) və P(A | B̄)</p>
            <BarChart
              ariaLabel="Şərti ehtimallar və 95% intervallar"
              yMax={1}
              yFormat={(v) => formatProbability(v, 1)}
              valueFormat={(v) => formatProbability(v)}
              groups={[
                { id: "b", label: "P(A | B)", bars: series.map((s) => s.b) },
                { id: "nb", label: "P(A | B̄)", bars: series.map((s) => s.notB) },
              ]}
              truth={truth ? [truth.aGivenB, truth.aGivenNotB] : undefined}
            />
            <Legend
              items={[
                ...(mode !== "auto" ? [{ kind: "swatch" as const, color: "var(--series-audience)", label: "Auditoriya" }] : []),
                ...(mode !== "audience" ? [{ kind: "swatch" as const, color: "var(--series-sim)", hatched: true, label: "Simulyasiya" }] : []),
                ...(truth ? [{ kind: "truth" as const, label: "Gizli həqiqət" }] : []),
              ]}
            />
          </div>
          {main?.oddsRatio && n >= 10 && (
            <p className="detail-line">
              Əmsallar nisbəti OR = {formatDecimal(main.oddsRatio.value, 2)}, 95% interval [{formatDecimal(main.oddsRatio.interval.lower, 2)};{" "}
              {formatDecimal(main.oddsRatio.interval.upper, 2)}]
            </p>
          )}
        </>
      }
      takeaway={takeaway}
    />
  );
}
