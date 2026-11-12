"use client";

import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { BarChart, type Bar } from "@/components/charts/BarChart";
import { Legend } from "@/components/charts/Legend";
import { KeyNumber, Stage } from "@/components/projector/Stage";
import { formatDecimal, formatInt, formatPercent } from "@/lib/format";
import type { ProjectorProps } from "../ui-types";
import { MAX_RUN_BUCKET, type SequenceSummary, type SequenceView } from "./definition";

const shares = (h: readonly number[]) => {
  const total = h.reduce((s, v) => s + v, 0);
  return h.map((v) => (total > 0 ? v / total : 0));
};

const meanRun = (h: readonly number[]) => {
  const total = h.reduce((s, v) => s + v, 0);
  return total > 0 ? h.reduce((s, v, i) => s + v * i, 0) / total : null;
};

function Sequence({ value }: { value: string }) {
  return (
    <p className="sequence" aria-label={`Ardıcıllıq ${value}`}>
      {[...value].map((c, i) => (
        <span key={i} className={c === "G" ? "flip flip-g" : "flip flip-r"}>
          {c}
        </span>
      ))}
    </p>
  );
}

export function RandomSeqProjector({ audience, sim, mode, fast }: ProjectorProps<SequenceView, SequenceSummary>) {
  const showAudience = mode !== "auto" && audience;
  const showSim = mode !== "audience" && sim;
  const expectedRuns = audience?.expectedRuns ?? sim?.expectedRuns ?? [];
  const audRuns = showAudience ? shares(audience.runHistogram) : null;
  const simRuns = showSim ? shares(sim.runHistogram) : null;

  const runGroups = Array.from({ length: MAX_RUN_BUCKET }, (_, k) => k + 1).map((k) => ({
    id: String(k),
    label: k === MAX_RUN_BUCKET ? `${k}+` : String(k),
    bars: [
      audRuns ? ({ id: `a${k}`, label: "", value: audRuns[k], color: "var(--series-audience)" } as Bar) : null,
      simRuns ? ({ id: `s${k}`, label: "", value: simRuns[k], color: "var(--series-sim)", hatched: true } as Bar) : null,
    ].filter((b): b is Bar => b !== null),
  }));

  const audMean = showAudience ? meanRun(audience.runHistogram) : null;
  const expectedMean = expectedRuns.reduce((s, p, i) => s + p * i, 0);
  const audLong = audRuns ? audRuns.slice(4).reduce((s, v) => s + v, 0) : null;
  const expectedLong = expectedRuns.slice(4).reduce((s, v) => s + v, 0);

  let takeaway: string | null = null;
  if (showAudience && audience.n >= 5 && audLong !== null) {
    takeaway = `Həqiqi təsadüfdə 20 atışda ${formatPercent(expectedLong, 0)} hallarda 4 və daha uzun seriya olur; sizdə - ${formatPercent(audLong, 0)}. İnsanlar uzun seriyalardan qaçır.`;
  }
  if (showSim && sim.accuracy !== null && sim.trained > 50) {
    takeaway = `${takeaway ? `${takeaway} ` : ""}Klassifikator insan və təsadüfi ardıcıllıqları ${formatPercent(sim.accuracy, 0)} dəqiqliklə ayırır.`;
  }

  return (
    <Stage
      instruction="Ən uzun seriya: ardıcıl eyni nəticələrin maksimal sayı (məs. GGGG → 4)."
      hero={
        <div className="hero-split">
          <div>
            <p className="chart-title">Ən uzun seriyanın paylanması</p>
            <BarChart
              ariaLabel="Ən uzun seriyanın paylanması: auditoriya, simulyasiya və dəqiq ehtimallar"
              yMax={0.6}
              yFormat={(v) => formatPercent(v, 0)}
              expected={Array.from({ length: MAX_RUN_BUCKET }, (_, k) => expectedRuns[k + 1] ?? 0)}
              expectedLabel="dəqiq ehtimal"
              groups={runGroups}
            />
          </div>
          {showSim && sim.latest && (
            <div>
              <p className="chart-title">Son təsadüfi ardıcıllıq (kompüter)</p>
              <Sequence value={sim.latest} />
            </div>
          )}
          {showAudience && audience.sequences[0] && (
            <div>
              <p className="chart-title">Son auditoriya ardıcıllığı</p>
              <Sequence value={audience.sequences[0]} />
            </div>
          )}
        </div>
      }
      side={
        <>
          <div className="key-row">
            {showAudience && (
              <KeyNumber label="auditoriya ardıcıllığı">
                <AnimatedNumber value={audience.n} format={formatInt} fast={fast} />
              </KeyNumber>
            )}
            {showSim && (
              <KeyNumber label="təsadüfi ardıcıllıq" tone="sim">
                <AnimatedNumber value={sim.n} format={formatInt} fast={fast} />
              </KeyNumber>
            )}
          </div>
          <p className="identity">
            Orta ən uzun seriya: təsadüfi {formatDecimal(expectedMean, 1)}
            {audMean !== null && <>, auditoriya {formatDecimal(audMean, 1)}</>}
          </p>
          {showSim && (
            <KeyNumber label="klassifikatorun dəqiqliyi" tone="truth" detail={sim.audienceCount > 0 ? `${sim.audienceCount} insan ardıcıllığı üzərində öyrənir` : "Auditoriya ardıcıllığı gözlənilir"}>
              {sim.accuracy !== null ? formatPercent(sim.accuracy, 0) : "-"}
            </KeyNumber>
          )}
          <Legend
            items={[
              { kind: "reference", label: "dəqiq ehtimal (sikkə)" },
              ...(showAudience ? [{ kind: "swatch" as const, color: "var(--series-audience)", label: "Auditoriya" }] : []),
              ...(showSim ? [{ kind: "swatch" as const, color: "var(--series-sim)", hatched: true, label: "Simulyasiya" }] : []),
            ]}
          />
        </>
      }
      takeaway={takeaway}
    />
  );
}
