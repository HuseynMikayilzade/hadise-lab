"use client";

import { useMemo } from "react";
import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { ConvergenceChart } from "@/components/charts/ConvergenceChart";
import { Legend } from "@/components/charts/Legend";
import { LinesChart } from "@/components/charts/LinesChart";
import { useAudienceHistory } from "@/components/hooks/useAudienceHistory";
import { KeyNumber, Stage } from "@/components/projector/Stage";
import { formatDecimal, formatInt, formatProbability } from "@/lib/format";
import type { ProjectorProps } from "../ui-types";
import type { PiSummary, PiView } from "./definition";
import { PointSquare } from "./PointSquare";

export function MonteCarloProjector({ audience, sim, mode, fast }: ProjectorProps<PiView, PiSummary>) {
  const simView = sim?.view ?? null;
  const main = mode === "auto" ? simView : (audience ?? simView);
  const audPoint = useMemo(
    () => (audience?.pi ? { n: audience.total, value: audience.pi.value, lower: audience.pi.interval.lower, upper: audience.pi.interval.upper } : null),
    [audience],
  );
  const audienceHistory = useAudienceHistory(audPoint);

  const total = main?.total ?? 0;
  const inside = main?.inside ?? 0;
  const p = total > 0 ? inside / total : null;
  const autoView = mode === "auto" && sim;

  const errorSeries = autoView
    ? [
        { id: "err", label: "|π̂ - π|", color: "var(--heading)", points: sim.history.map((h) => ({ n: h.n, value: Math.max(1e-4, Math.abs(h.estimate - Math.PI)) })) },
        { id: "rate", label: "1/√n", color: "var(--muted)", dashed: true, points: sim.history.map((h) => ({ n: h.n, value: 1.64 / Math.sqrt(h.n) })) },
      ]
    : [];

  return (
    <Stage
      instruction="Nöqtə kvadrata təsadüfi düşür. Dairəyə düşmə ehtimalı = sahələrin nisbəti = π/4."
      hero={
        <div className="hero-split square-split">
          <PointSquare points={main?.points ?? []} />
          {autoView ? (
            <div className="chart-stack">
              <ConvergenceChart
                ariaLabel="π təxmininin yaxınlaşması"
                series={[{ id: "sim", label: "Simulyasiya", kind: "sim", points: sim.history.map((h) => ({ n: h.n, value: h.estimate, lower: h.lower, upper: h.upper })) }]}
                refs={[{ value: Math.PI, label: "π", kind: "reference" }]}
                yDomain={[2.6, 3.7]}
                yFormat={(v) => formatDecimal(v, 1)}
                xLabel="nöqtələrin sayı n"
                logX
              />
              <LinesChart
                ariaLabel="Xətanın n artdıqca 1/√n sürəti ilə azalması (loqarifmik miqyas)"
                series={errorSeries}
                yDomain={[1e-4, 2]}
                yFormat={(v) => formatDecimal(v, v < 0.01 ? 4 : 2)}
                xLabel="n (log miqyas): xəta 1/√n kimi azalır"
                logX
                logY
              />
            </div>
          ) : (
            <ConvergenceChart
              ariaLabel="π təxmininin yaxınlaşması"
              series={[
                ...(mode !== "auto" ? [{ id: "aud", label: "Auditoriya", kind: "audience" as const, points: audienceHistory }] : []),
                ...(mode === "both" && sim ? [{ id: "sim", label: "Simulyasiya", kind: "sim" as const, points: sim.history.map((h) => ({ n: h.n, value: h.estimate, lower: h.lower, upper: h.upper })) }] : []),
              ]}
              refs={[{ value: Math.PI, label: "π", kind: "reference" }]}
              yDomain={[2.4, 3.9]}
              yFormat={(v) => formatDecimal(v, 1)}
              xLabel="nöqtələrin sayı n"
              logX={mode === "both"}
            />
          )}
        </div>
      }
      side={
        <>
          <div className="key-row">
            <KeyNumber label="nöqtə (n)">
              <AnimatedNumber value={total} format={formatInt} fast={fast} />
            </KeyNumber>
            <KeyNumber label="dairədə" detail={<span className="math">P = {p !== null ? formatProbability(p, 3) : "-"}, π/4 = 0,785</span>}>
              <AnimatedNumber value={inside} format={formatInt} fast={fast} />
            </KeyNumber>
          </div>
          <KeyNumber
            label={<span className="math">π ≈ 4·P</span>}
            tone={mode === "auto" ? "sim" : "a"}
            detail={main?.pi ? `95% interval [${formatDecimal(main.pi.interval.lower, 3)}; ${formatDecimal(main.pi.interval.upper, 3)}]` : undefined}
          >
            <AnimatedNumber value={main?.pi?.value ?? null} format={(v) => formatDecimal(v, 4)} fast={fast} />
          </KeyNumber>
          <Legend
            items={[
              { kind: "swatch", color: "var(--event-a)", label: "dairədə (●)" },
              { kind: "swatch", color: "var(--event-b)", label: "dairədən kənar (■)" },
              ...(autoView ? [{ kind: "swatch" as const, color: "var(--heading)", label: "|π̂ - π| xəta" }, { kind: "reference" as const, label: "1,64/√n (standart xəta)" }] : []),
              ...(mode !== "auto" ? [{ kind: "audience" as const, label: "Auditoriya" }] : []),
              ...(mode !== "audience" ? [{ kind: "sim" as const, label: "Simulyasiya" }] : []),
            ]}
          />
        </>
      }
      takeaway={
        main?.pi && total >= 1000
          ? `${formatInt(total)} nöqtə ilə π ≈ ${formatDecimal(main.pi.value, 4)} (həqiqi π = 3,1416). Xəta 1/√n kimi azalır: 100 dəfə çox nöqtə - 10 dəfə dəqiq.`
          : null
      }
    />
  );
}
