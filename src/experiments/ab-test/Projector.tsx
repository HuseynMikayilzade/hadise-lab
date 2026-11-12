"use client";

import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { DensityChart } from "@/components/charts/DensityChart";
import { Legend } from "@/components/charts/Legend";
import { LinesChart } from "@/components/charts/LinesChart";
import { KeyNumber, Stage } from "@/components/projector/Stage";
import { formatInt, formatPercent } from "@/lib/format";
import type { ProjectorProps } from "../ui-types";
import { VARIANT_COLORS } from "./colors";
import { VARIANTS, type AbSummary, type AbView, type ArmView } from "./definition";


function ArmTable({ arms, caption, truth }: { arms: readonly ArmView[]; caption: string; truth?: readonly number[] | null }) {
  return (
    <table className="arm-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Variant</th>
          <th scope="col">göstərilib</th>
          <th scope="col">klik nisbəti</th>
          <th scope="col">ən yaxşı olma ehtimalı</th>
          {truth && <th scope="col">həqiqi</th>}
        </tr>
      </thead>
      <tbody>
        {arms.map((arm, i) => (
          <tr key={VARIANTS[i].id}>
            <th scope="row">
              <span className="swatch" style={{ background: VARIANT_COLORS[i] }} aria-hidden="true" />
              {VARIANTS[i].label}
            </th>
            <td className="num">{formatInt(arm.shows)}</td>
            <td className="num">{arm.shows > 0 ? formatPercent(arm.estimate.bayes.value) : "-"}</td>
            <td className="num">{formatPercent(arm.probabilityBest, 0)}</td>
            {truth && <td className="num truth-cell">{formatPercent(truth[i])}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AbProjector({ audience, sim, mode, fast }: ProjectorProps<AbView, AbSummary>) {
  const truth = sim?.truth ?? null;
  const useSim = mode !== "audience" && sim;
  const arms = useSim ? sim.thompson : (audience?.arms ?? []);

  const curves = arms.map((arm, i) => ({
    id: VARIANTS[i].id,
    label: VARIANTS[i].label,
    posterior: arm.estimate.posterior,
    color: VARIANT_COLORS[i],
  }));
  const audienceCurves =
    mode === "both" && audience
      ? audience.arms.map((arm, i) => ({ id: `aud-${VARIANTS[i].id}`, label: `${VARIANTS[i].label} (auditoriya)`, posterior: arm.estimate.posterior, color: VARIANT_COLORS[i], dashed: true }))
      : [];

  const visitors = useSim ? sim.visitors : (audience?.visitors ?? 0);
  const saved = useSim ? sim.splitRegret - sim.thompsonRegret : 0;

  let takeaway: string | null = null;
  if (useSim && sim.visitors >= 500) {
    takeaway = `Bayes qaydası məlumatı qərara çevirir: alqoritm bərabər bölgüdən ${formatInt(Math.max(0, saved))} klik az itirib.`;
  }
  if (truth && useSim) {
    const best = truth.rates.indexOf(Math.max(...truth.rates));
    const shares = sim.thompson.map((a) => (sim.visitors > 0 ? a.shows / sim.visitors : 0));
    takeaway = `Gizli həqiqət: ən yaxşı ${VARIANTS[best].label} (${formatPercent(truth.rates[best])}). Alqoritm trafikin ${formatPercent(shares[best], 0)}-ni ona yönəldib və ${formatInt(sim.visitors)} ziyarətçidə ${formatInt(Math.max(0, saved))} klik az itirib.`;
  }

  return (
    <Stage
      instruction="Hər ziyarətçiyə hansı reklamı göstərək? Thompson alqoritmi posteriorlardan nümunə çəkib qərar verir."
      hero={
        <div className="hero-split">
          <div>
            <p className="chart-title">Klik nisbətinin posterior paylanmaları (Beta)</p>
            <DensityChart
              ariaLabel="Üç reklamın klik nisbəti üçün Beta posterior sıxlıqları"
              curves={[...curves, ...audienceCurves]}
              truths={truth ? truth.rates.map((r, i) => ({ id: VARIANTS[i].id, value: r, label: VARIANTS[i].id.toUpperCase() })) : []}
              xFormat={(v) => formatPercent(v, 0)}
            />
          </div>
          {useSim ? (
            <div className="chart-pair">
              <div>
                <p className="chart-title">Trafik payı</p>
                <LinesChart
                  ariaLabel="Hər reklamın trafik payının zamanla dəyişməsi"
                  series={VARIANTS.map((v, i) => ({ id: v.id, label: v.label, color: VARIANT_COLORS[i], points: sim.history.map((h) => ({ n: h.n, value: h.shares[i] })) }))}
                  yDomain={[0, 1]}
                  yFormat={(v) => formatPercent(v, 0)}
                  xLabel="ziyarətçi"
                  guides={[{ value: 1 / 3, label: "1/3" }]}
                />
              </div>
              <div>
                <p className="chart-title">Kumulyativ itki (regret)</p>
                <LinesChart
                  ariaLabel="Thompson alqoritmi və bərabər bölgünün kumulyativ itkisi"
                  series={[
                    { id: "split", label: "Bərabər bölgü", color: "var(--muted)", dashed: true, points: sim.history.map((h) => ({ n: h.n, value: h.splitRegret })) },
                    { id: "ts", label: "Thompson", color: "var(--heading)", points: sim.history.map((h) => ({ n: h.n, value: h.thompsonRegret })) },
                  ]}
                  yDomain={[0, Math.max(1, ...sim.history.map((h) => h.splitRegret))]}
                  yFormat={(v) => formatInt(v)}
                  xLabel="ziyarətçi"
                />
              </div>
            </div>
          ) : null}
        </div>
      }
      side={
        <>
          <div className="key-row">
            <KeyNumber label={useSim ? "simulyasiya: ziyarətçi" : "ziyarətçi"}>
              <AnimatedNumber value={visitors} format={formatInt} fast={fast} />
            </KeyNumber>
            {useSim && (
              <KeyNumber label="qənaət edilən klik" tone="sim" detail="bərabər bölgü ilə müqayisədə">
                <AnimatedNumber value={Math.max(0, saved)} format={(v) => formatInt(v)} fast={fast} />
              </KeyNumber>
            )}
          </div>
          <ArmTable arms={arms} caption={useSim ? "Simulyasiya (Thompson)" : "Auditoriya"} truth={truth?.rates ?? null} />
          {mode === "both" && audience && <ArmTable arms={audience.arms} caption="Auditoriya (real kliklər)" />}
          <Legend
            items={[
              ...VARIANTS.map((v, i) => ({ kind: "swatch" as const, color: VARIANT_COLORS[i], label: v.label })),
              ...(useSim ? [{ kind: "reference" as const, label: "bərabər bölgü (1/3)" }] : []),
              ...(truth ? [{ kind: "truth" as const, label: "Gizli həqiqət" }] : []),
            ]}
          />
        </>
      }
      takeaway={takeaway}
    />
  );
}
