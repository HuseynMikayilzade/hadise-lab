"use client";

import { useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { BarChart, type Bar } from "@/components/charts/BarChart";
import { ConvergenceChart, type ConvergenceSeries } from "@/components/charts/ConvergenceChart";
import { Legend } from "@/components/charts/Legend";
import { useAudienceHistory } from "@/components/hooks/useAudienceHistory";
import { KeyNumber, Segmented, Stage } from "@/components/projector/Stage";
import { formatDecimal, formatInt, formatProbability } from "@/lib/format";
import { wilsonInterval } from "@/lib/probability";
import type { ProjectorProps } from "../ui-types";
import { DICE_EVENTS, eventCount, FACES, type DiceEventId, type DiceSummary, type DiceView } from "./definition";

function eventSeries(id: string, label: string, kind: "audience" | "sim", history: readonly { n: number; counts: number[] }[], faces: readonly number[]): ConvergenceSeries {
  return {
    id,
    label,
    kind,
    points: history.map((h) => {
      const m = eventCount(h.counts, faces);
      const ci = wilsonInterval(m, h.n);
      return { n: h.n, value: m / h.n, lower: ci?.lower, upper: ci?.upper };
    }),
  };
}

function chiText(view: DiceView): string {
  if (view.chi.kind === "insufficient") return `Hökm üçün ən azı ${view.chi.minN} atış lazımdır.`;
  const p = formatDecimal(view.chi.pValue, 3);
  return view.chi.reject
    ? `χ² = ${formatDecimal(view.chi.statistic, 1)}, p = ${p}: zər qərəzlidir (5% səviyyəsində).`
    : `χ² = ${formatDecimal(view.chi.statistic, 1)}, p = ${p}: zərin düzgün olmadığına dair əlamət yoxdur.`;
}

export function DiceProjector({ audience, sim, mode, fast }: ProjectorProps<DiceView, DiceSummary>) {
  const [eventId, setEventId] = useState<DiceEventId>("even");
  const event = DICE_EVENTS.find((e) => e.id === eventId)!;
  const simView = sim?.view ?? null;
  const main = mode === "auto" ? simView : audience;
  const truth = sim?.truth ?? null;

  const audiencePoint = useMemo(() => (audience ? { n: audience.n, counts: audience.counts } : null), [audience]);
  const audienceHistory = useAudienceHistory(audiencePoint);

  const n = main?.n ?? 0;
  const m = main ? eventCount(main.counts, event.faces) : 0;
  const classical = event.faces.length / 6;

  const bars = (view: DiceView | null, kind: "audience" | "sim"): (Bar | null)[] =>
    FACES.map((f, i) =>
      view && view.n > 0
        ? {
            id: `${kind}-${f}`,
            label: String(f),
            value: view.counts[i] / view.n,
            interval: view.frequencies[i]?.interval,
            color: (event.faces as readonly number[]).includes(f) ? "var(--event-a)" : "var(--muted-fill)",
            hatched: kind === "sim",
          }
        : null,
    );
  const audienceBars = mode !== "auto" ? bars(audience, "audience") : [];
  const simBars = mode !== "audience" ? bars(simView, "sim") : [];
  const yMax = Math.max(0.35, ...[...audienceBars, ...simBars].map((b) => (b ? Math.min(1, (b.interval?.upper ?? b.value) + 0.02) : 0)));

  const series: ConvergenceSeries[] = [];
  if (mode !== "auto" && audienceHistory.length > 0) series.push(eventSeries("aud", "Auditoriya", "audience", audienceHistory, event.faces));
  if (mode !== "audience" && sim) series.push(eventSeries("sim", "Simulyasiya", "sim", sim.history, event.faces));
  const trueP = truth ? eventCount(truth.probabilities, event.faces) : null;

  let takeaway: string | null = n >= 30 ? `n böyüdükcə W(A) = m/n klassik P(A) = ${formatProbability(classical)} ətrafında sabitləşir: statistik tərif klassik tərifə yaxınlaşır.` : null;
  if (truth && simView && sim) {
    const maxError = Math.max(...sim.posteriors.map((p, i) => Math.abs(p.value - truth.probabilities[i])));
    takeaway = `Gizli həqiqət: zər ${truth.fair ? "düzgün idi" : "qərəzli idi"}. ${formatInt(simView.n)} atışdan sonra öyrənilən ehtimallar həqiqi dəyərlərdən ən çox ${formatProbability(maxError, 3)} fərqlənir.`;
  }

  return (
    <Stage
      instruction="Ω = {1, 2, 3, 4, 5, 6}. Hadisə seçin:"
      toolbar={<Segmented label="Hadisə" options={DICE_EVENTS.map((e) => ({ id: e.id, label: e.label }))} value={eventId} onChange={setEventId} />}
      hero={
        <div className="hero-split">
          <BarChart
            ariaLabel="Hər üzün nisbi tezliyi və 95% intervalı"
            yMax={yMax}
            yFormat={(v) => formatProbability(v)}
            expected={FACES.map(() => 1 / 6)}
            expectedLabel="1/6"
            truth={truth ? truth.probabilities : undefined}
            groups={FACES.map((f, i) => ({
              id: String(f),
              label: `${f}`,
              bars: [audienceBars[i], simBars[i]].filter((b): b is Bar => Boolean(b)),
            }))}
          />
          <ConvergenceChart
            ariaLabel={`${event.label}: nisbi tezliyin n artdıqca yaxınlaşması`}
            series={series}
            refs={[
              { value: classical, label: `P(A) = ${formatProbability(classical)}`, kind: "reference" },
              ...(trueP !== null ? [{ value: trueP, label: `həqiqi ${formatProbability(trueP)}`, kind: "truth" as const }] : []),
            ]}
            yDomain={[0, 1]}
            logX={(sim?.view.n ?? 0) > 200}
          />
        </div>
      }
      side={
        <>
          <div className="key-row">
            <KeyNumber label="atış (n)">
              <AnimatedNumber value={n} format={formatInt} fast={fast} />
            </KeyNumber>
          </div>
          <div className="key-row">
            <KeyNumber label={<span className="math">klassik P(A) = m/6</span>} detail={`${event.faces.length} / 6`}>
              {formatProbability(classical)}
            </KeyNumber>
            <KeyNumber label={<span className="math">statistik W(A) = m/n</span>} tone="a" detail={`${m} / ${n}`}>
              <AnimatedNumber value={n > 0 ? m / n : null} format={(v) => formatProbability(v)} fast={fast} />
            </KeyNumber>
          </div>
          <p className="identity math">{event.label}: {"{"}{event.faces.join(", ")}{"}"}</p>
          {main && <p className="detail-line">{chiText(main)}</p>}
          <Legend
            items={[
              { kind: "swatch", color: "var(--event-a)", label: "A-ya daxil olan üzlər" },
              { kind: "reference", label: "1/6 (düzgün zər)" },
              ...(mode !== "auto" ? [{ kind: "audience" as const, label: "Auditoriya" }] : []),
              ...(mode !== "audience" ? [{ kind: "sim" as const, label: "Simulyasiya (ştrixli)" }] : []),
              ...(truth ? [{ kind: "truth" as const, label: "Gizli həqiqət" }] : []),
            ]}
          />
        </>
      }
      takeaway={takeaway}
    />
  );
}
