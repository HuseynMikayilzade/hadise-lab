"use client";

import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { BarChart, type Bar } from "@/components/charts/BarChart";
import { Legend } from "@/components/charts/Legend";
import { KeyNumber, Stage } from "@/components/projector/Stage";
import { formatDecimal, formatInt, formatProbability } from "@/lib/format";
import type { ProjectorProps } from "../ui-types";
import { SEASONS, type SeasonsSummary, type SeasonsView } from "./definition";

const SEASON_COLORS = ["var(--season-1)", "var(--season-2)", "var(--season-3)", "var(--season-4)"];

/** Ω tam qrupa bölünür: dörd kəsişməyən hissə, eni saya mütənasibdir. */
function Partition({ view }: { view: SeasonsView }) {
  const n = view.n;
  let x = 0;
  return (
    <svg className="partition" viewBox="0 0 600 260" role="img" aria-label={SEASONS.map((s, i) => `${s.label} ${view.counts[i]}`).join(", ")}>
      <rect className="omega" x="1" y="1" width="598" height="258" rx="14" />
      <text className="omega-label" x="12" y="30">Ω</text>
      {SEASONS.map((s, i) => {
        const w = n > 0 ? (view.counts[i] / n) * 560 : 140;
        const rx = x;
        x += w;
        return (
          <g key={s.id} className="part" style={{ color: SEASON_COLORS[i] }}>
            <rect className="part-rect" style={{ x: 20 + rx, width: Math.max(0, w - 4) } as React.CSSProperties} y="40" height="200" rx="10" />
            {/* Dar hissələrdə mətn kiçilir; çox dar olduqda yalnız say göstərilir. */}
            {w >= 44 && (
              <>
                {w >= 96 && (
                  <text className="part-label" x={20 + rx + w / 2} y="120" textAnchor="middle">
                    {s.label}
                  </text>
                )}
                <text className="part-count" x={20 + rx + w / 2} y={w >= 96 ? 162 : 140} textAnchor="middle" fontSize={w >= 96 ? 40 : 24}>
                  {view.counts[i]}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function verdict(view: SeasonsView): string {
  if (view.chi.kind === "insufficient") return `Bərabər imkanlılıq hökmü üçün ən azı ${view.chi.minN} cavab lazımdır.`;
  const p = formatDecimal(view.chi.pValue, 3);
  return view.chi.reject
    ? `χ² testi: p = ${p} < 0,05 - fəsillər bərabər imkanlı deyil.`
    : `χ² testi: p = ${p} - bərabər imkanlılıqdan statistik fərq görünmür.`;
}

export function SeasonsProjector({ audience, sim, mode, fast }: ProjectorProps<SeasonsView, SeasonsSummary>) {
  const simView = sim?.view ?? null;
  const main = mode === "auto" ? simView : audience;
  const empty: SeasonsView = { counts: [0, 0, 0, 0], n: 0, shares: [null, null, null, null], chi: { kind: "insufficient", minN: 20 } };
  const view = main ?? empty;
  const truth = sim?.truth ?? null;

  const bars = (v: SeasonsView | null, kind: "audience" | "sim"): (Bar | null)[] =>
    SEASONS.map((s, i) =>
      v && v.n > 0 ? { id: `${kind}-${s.id}`, label: s.label, value: v.counts[i] / v.n, interval: v.shares[i]?.interval, color: SEASON_COLORS[i], hatched: kind === "sim" } : null,
    );
  const aud = mode !== "auto" ? bars(audience, "audience") : [];
  const sm = mode !== "audience" ? bars(simView, "sim") : [];
  const shares = view.counts.map((c) => (view.n > 0 ? c / view.n : 0));
  const sumText = shares.map((p) => formatProbability(p)).join(" + ");

  let takeaway: string | null = view.n > 0 ? "Fəsillər cüt-cüt kəsişmir və birləşməsi Ω-dır: tam qrup. Ehtimallar cəmi 1-dir (normallaşdırma aksiomu)." : null;
  if (truth && simView) {
    const maxDeviation = Math.max(...truth.probabilities.map((p) => Math.abs(p - 0.25)));
    const subtle = simView.chi.kind === "ok" && simView.chi.reject && maxDeviation < 0.06;
    takeaway = `Gizli həqiqət: paylar ${truth.probabilities.map((p) => formatProbability(p)).join(", ")} idi (0,25-dən ən böyük fərq ${formatProbability(maxDeviation)}). ${formatInt(simView.n)} nümunədən sonra: ${verdict(simView)}${subtle ? " Böyük n kiçik fərqləri də aşkar edir." : ""}`;
  }

  return (
    <Stage
      instruction="Hər kəs yalnız bir fəsildə doğulub: hadisələr birgə deyil və birlikdə bütün Ω-nı əhatə edir."
      hero={<Partition view={view} />}
      side={
        <>
          <div className="key-row">
            <KeyNumber label="cavab (n)">
              <AnimatedNumber value={view.n} format={formatInt} fast={fast} />
            </KeyNumber>
            <KeyNumber label={<span className="math">ΣP</span>} tone="correct">
              {view.n > 0 ? formatProbability(shares.reduce((s, p) => s + p, 0)) : "-"}
            </KeyNumber>
          </div>
          {view.n > 0 && <p className="identity math">{sumText} = 1</p>}
          <div className="mini-chart">
            <p className="chart-title">Bərabər imkanlıdırmı? Hər pay 0,25 ilə müqayisədə</p>
            <BarChart
              ariaLabel="Fəsillərin payları, 95% intervallar və 0,25 xətti"
              yMax={0.7}
              yFormat={(v) => formatProbability(v, 1)}
              expected={SEASONS.map(() => 0.25)}
              expectedLabel="0,25"
              truth={truth?.probabilities}
              groups={SEASONS.map((s, i) => ({ id: s.id, label: s.label, bars: [aud[i], sm[i]].filter((b): b is Bar => Boolean(b)) }))}
            />
            <Legend
              items={[
                { kind: "reference", label: "0,25 (bərabər imkan)" },
                ...(mode === "both" ? [{ kind: "swatch" as const, color: "var(--muted)", hatched: true, label: "Simulyasiya (ştrixli)" }] : []),
                ...(truth ? [{ kind: "truth" as const, label: "Gizli həqiqət" }] : []),
              ]}
            />
          </div>
          <p className="detail-line">{verdict(view)}</p>
        </>
      }
      takeaway={takeaway}
    />
  );
}
