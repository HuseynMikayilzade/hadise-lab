"use client";

import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { BarChart } from "@/components/charts/BarChart";
import { ConvergenceChart } from "@/components/charts/ConvergenceChart";
import { Legend } from "@/components/charts/Legend";
import { KeyNumber, Stage } from "@/components/projector/Stage";
import { formatDecimal, formatInt, formatPercent } from "@/lib/format";
import { DEFAULT_SCENARIO, naturalFrequencies } from "@/lib/stats/bayes";
import type { ProjectorProps } from "../ui-types";
import { GUESS_BUCKET, type BayesSummary, type BayesView, type SequentialPatient } from "./definition";
import { FrequencyTree } from "./FrequencyTree";
import { SCENARIO_TEXT } from "./scenario";

const ANSWER = naturalFrequencies(DEFAULT_SCENARIO);

function GuessHistogram({ view }: { view: BayesView }) {
  const maxShare = Math.max(0.2, ...view.buckets.map((b) => (view.n > 0 ? b / view.n : 0)));
  const answerBucket = Math.floor((view.answer * 100) / GUESS_BUCKET);
  return (
    <BarChart
      ariaLabel="Auditoriyanın təxminlərinin paylanması"
      yMax={Math.min(1, maxShare + 0.05)}
      yFormat={(v) => formatPercent(v, 0)}
      groups={view.buckets.map((count, i) => ({
        id: String(i),
        label: i % 2 === 0 ? `${i * GUESS_BUCKET}` : "",
        bars: [
          {
            id: `b${i}`,
            label: `${i * GUESS_BUCKET}-${(i + 1) * GUESS_BUCKET}%`,
            value: view.n > 0 ? count / view.n : 0,
            color: view.revealed && i === answerBucket ? "var(--correct)" : "var(--series-audience)",
            highlight: view.revealed && i === answerBucket,
          },
        ],
      }))}
    />
  );
}

function PatientChain({ patient }: { patient: SequentialPatient }) {
  return (
    <div className="patient">
      <p className="chart-title">Ardıcıl testləmə: bir pasiyent, təkrar testlər</p>
      <ol className="chain">
        <li>
          <span className="chain-label">prior</span>
          <span className="chain-value">{formatPercent(patient.prior)}</span>
        </li>
        {patient.tests.map((t, i) => (
          <li key={i} className={t.positive ? "pos" : "neg"}>
            <span className="chain-label">{t.positive ? "+" : "−"}</span>
            <span className="chain-value">{formatPercent(t.posterior)}</span>
          </li>
        ))}
      </ol>
      <p className="detail-line">Hər posterior növbəti test üçün prior olur.</p>
    </div>
  );
}

export function BayesProjector({ audience, sim, mode, control, fast }: ProjectorProps<BayesView, BayesSummary>) {
  const revealed = control.reveal > 0;
  const truth = sim?.truth ?? null;
  const showAudience = mode !== "auto" && audience;
  const showSim = mode !== "audience" && sim;

  const hero = showAudience ? (
    revealed ? (
      <div className="hero-split">
        <FrequencyTree f={ANSWER} scenario={DEFAULT_SCENARIO} />
        <GuessHistogram view={audience} />
      </div>
    ) : (
      <div className="hero-split">
        <p className="scenario">{SCENARIO_TEXT}</p>
        <GuessHistogram view={audience} />
      </div>
    )
  ) : showSim ? (
    <div className="hero-split">
      <ConvergenceChart
        ariaLabel="Simulyasiyada P(xəstə | müsbət) təxmininin yaxınlaşması"
        series={[{ id: "sim", label: "Simulyasiya", kind: "sim", points: sim.history }]}
        refs={[
          { value: sim.scenarioAnswer, label: `ssenari ${formatPercent(sim.scenarioAnswer)}`, kind: "reference" },
          ...(truth ? [{ value: truth.answer, label: `həqiqi ${formatPercent(truth.answer)}`, kind: "truth" as const }] : []),
        ]}
        yDomain={[0, 0.3]}
        yFormat={(v) => formatPercent(v, 0)}
        xLabel="müsbət test alanların sayı"
        logX={sim.positive > 200}
      />
      {revealed ? <FrequencyTree f={ANSWER} scenario={DEFAULT_SCENARIO} /> : <p className="scenario">{SCENARIO_TEXT}</p>}
    </div>
  ) : (
    <p className="scenario">{SCENARIO_TEXT}</p>
  );

  let takeaway: string | null = null;
  if (revealed) {
    takeaway = `Müsbət testlərin çoxu sağlam insanlardandır (${formatDecimal(ANSWER.healthyPositive, 1)} və ${formatDecimal(ANSWER.illPositive, 0)}). Baza ehtimalının unudulması (Tversky və Kahneman) təxminləri şişirdir.`;
  }
  if (truth && sim) {
    takeaway = `Gizli parametrlər: yayılma ${formatPercent(truth.prevalence)}, həssaslıq ${formatPercent(truth.sensitivity, 0)}, yalançı müsbət ${formatPercent(truth.falsePositiveRate)}. ${formatInt(sim.population)} nəfərlik simulyasiyada P(X | +) = ${formatPercent(sim.estimate.bayes.value)}, düstur ${formatPercent(truth.answer)}.`;
  }

  return (
    <Stage
      instruction={revealed ? "Cavab: P(xəstə | müsbət) = P(+ | X)·P(X) / P(+)" : "Təxmin edin: test müsbətdirsə, xəstə olma ehtimalı nədir?"}
      hero={hero}
      side={
        <>
          {showAudience && (
            <div className="key-row">
              <KeyNumber label="təxmin (n)">
                <AnimatedNumber value={audience.n} format={formatInt} fast={fast} />
              </KeyNumber>
              <KeyNumber label="orta təxmin" tone="a">
                <AnimatedNumber value={audience.meanGuess} format={(v) => formatPercent(v, 0)} fast={fast} />
              </KeyNumber>
            </div>
          )}
          {revealed && (
            <>
              <KeyNumber label={<span className="math">P(X | +)</span>} tone="correct" detail={`${formatDecimal(ANSWER.illPositive, 0)} / ${formatDecimal(ANSWER.positive, 1)}`}>
                {formatPercent(ANSWER.illPositive / ANSWER.positive)}
              </KeyNumber>
              <p className="identity math">
                P(+) = 0,9·0,01 + 0,09·0,99 = {formatDecimal(ANSWER.positive / ANSWER.population, 4)}
              </p>
            </>
          )}
          {showSim && (
            <>
              <div className="key-row">
                <KeyNumber label="simulyasiya: insan">
                  <AnimatedNumber value={sim.population} format={formatInt} fast={fast} />
                </KeyNumber>
                <KeyNumber label={<span className="math">P̂(X | +)</span>} tone="sim" detail={`${sim.illPositive} / ${sim.positive}`}>
                  <AnimatedNumber value={sim.positive > 0 ? sim.estimate.bayes.value : null} format={(v) => formatPercent(v)} fast={fast} />
                </KeyNumber>
              </div>
              {sim.patient && mode === "auto" && <PatientChain patient={sim.patient} />}
              <Legend
                items={[
                  { kind: "sim", label: "Simulyasiya" },
                  { kind: "reference", label: "Ssenarinin Bayes cavabı" },
                  ...(truth ? [{ kind: "truth" as const, label: "Gizli parametrlərlə cavab" }] : []),
                ]}
              />
            </>
          )}
        </>
      }
      takeaway={takeaway}
    />
  );
}
