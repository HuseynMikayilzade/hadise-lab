"use client";

import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { BarChart } from "@/components/charts/BarChart";
import { ConvergenceChart } from "@/components/charts/ConvergenceChart";
import { Legend } from "@/components/charts/Legend";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { linearScale, linePath } from "@/components/charts/scale";
import { KeyNumber, Stage } from "@/components/projector/Stage";
import { formatInt, formatPercent } from "@/lib/format";
import { birthdayCurve, birthdayMatchProbability } from "@/lib/stats/birthday";
import type { ProjectorProps } from "../ui-types";
import { birthday, GUESS_OPTIONS, guessBucketFor, type BirthdaySummary, type BirthdayView } from "./definition";

const CURVE = birthdayCurve(80);

/** P(ən azı bir uyğunluq) n-in funksiyası kimi; cari n işarələnir. */
function ProbabilityCurve({ n }: { n: number }) {
  return <ChartFrame>{(size) => <ProbabilityCurveSvg n={n} W={size.width} H={size.height} />}</ChartFrame>;
}

function ProbabilityCurveSvg({ n, W, H }: { n: number; W: number; H: number }) {
  const M = { top: 16, right: 20, bottom: 40, left: 52 };
  const x = linearScale([1, 80], [M.left, W - M.right]);
  const y = linearScale([0, 1], [H - M.bottom, M.top]);
  const p = birthdayMatchProbability(n);
  const clampedN = Math.min(Math.max(n, 1), 80);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`n = ${n} üçün ehtimal ${formatPercent(p)}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line className="grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
          <text className="tick" x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
            {formatPercent(t, 0)}
          </text>
        </g>
      ))}
      {[1, 10, 20, 30, 40, 50, 60, 70, 80].map((t) => (
        <text key={t} className="tick" x={x(t)} y={H - M.bottom + 18} textAnchor="middle">
          {t}
        </text>
      ))}
      <text className="axis-label" x={(M.left + W - M.right) / 2} y={H - 4} textAnchor="middle">
        qrupdakı insanların sayı n
      </text>
      <path className="curve" d={linePath(CURVE.map((c) => ({ x: x(c.n), y: y(c.p) })))} />
      <g className="current-n">
        <line x1={x(clampedN)} x2={x(clampedN)} y1={y(0)} y2={y(p)} />
        <circle cx={x(clampedN)} cy={y(p)} r={8} />
        <text x={x(clampedN) + (clampedN > 55 ? -12 : 12)} y={y(p) + 24} textAnchor={clampedN > 55 ? "end" : "start"}>
          n = {n}: {formatPercent(p)}
        </text>
      </g>
    </svg>
  );
}

function GuessBars({ view, correct }: { view: BirthdayView; correct: string | null }) {
  return (
    <BarChart
      ariaLabel="Auditoriyanın ehtimal təxminləri"
      yMax={1}
      yFormat={(v) => formatPercent(v, 0)}
      valueFormat={(v) => formatPercent(v, 0)}
      groups={GUESS_OPTIONS.map((g) => ({
        id: g.id,
        label: g.label,
        bars: [
          {
            id: g.id,
            label: g.label,
            value: view.guessTotal > 0 ? view.guesses[g.id] / view.guessTotal : 0,
            color: correct === g.id ? "var(--correct)" : "var(--series-audience)",
            highlight: correct === g.id,
          },
        ],
      }))}
    />
  );
}

export function BirthdayProjector({ audience, sim, mode, control, fast, presenter, snapshot, setParam }: ProjectorProps<BirthdayView, BirthdaySummary>) {
  const revealed = control.reveal > 0;
  const showAudience = mode !== "auto" && audience;
  const showSim = mode !== "audience" && sim;
  const n = showAudience ? audience.n : (sim?.n ?? 23);
  const exact = birthdayMatchProbability(n);
  const spec = birthday.engine!.params![0];

  const hero = showAudience ? (
    <div className="hero-split">
      {revealed ? <ProbabilityCurve n={n} /> : <p className="scenario">Bu otaqda ən azı iki nəfərin ad günü eyni gündür. Bunun ehtimalı nə qədərdir?</p>}
      <GuessBars view={audience} correct={revealed ? guessBucketFor(exact) : null} />
    </div>
  ) : showSim ? (
    <div className="hero-split">
      <ConvergenceChart
        ariaLabel={`n = ${sim.n} üçün simulyasiya tezliyinin dəqiq ehtimala yaxınlaşması`}
        series={[{ id: "sim", label: "Simulyasiya", kind: "sim", points: sim.history }]}
        refs={[{ value: sim.exact, label: `dəqiq ${formatPercent(sim.exact)}`, kind: "reference" }]}
        yDomain={[0, 1]}
        yFormat={(v) => formatPercent(v, 0)}
        xLabel="təsadüfi qrupların sayı"
        logX={sim.groups > 200}
      />
      <ProbabilityCurve n={sim.n} />
    </div>
  ) : null;

  return (
    <Stage
      instruction={showAudience && !revealed ? "Təxmininizi telefonda göndərin. Cavabı əks hadisə ilə hesablayacağıq." : "P(A) = 1 - P(Ā) = 1 - (365·364·...·(365 - n + 1)) / 365ⁿ"}
      toolbar={
        showSim && presenter && snapshot ? (
          <label className="param">
            <span>{spec.label}: {snapshot.params.n}</span>
            <input type="range" min={spec.min} max={spec.max} step={spec.step} value={snapshot.params.n ?? spec.initial} onChange={(e) => setParam("n", Number(e.target.value))} />
          </label>
        ) : undefined
      }
      hero={hero}
      side={
        <>
          {showAudience && (
            <div className="key-row">
              <KeyNumber label="iştirakçı (n)">
                <AnimatedNumber value={audience.n} format={formatInt} fast={fast} />
              </KeyNumber>
              {revealed && (
                <KeyNumber label="ən azı bir uyğunluq" tone="correct">
                  {formatPercent(exact)}
                </KeyNumber>
              )}
            </div>
          )}
          {showAudience && revealed && (
            <div className="matches">
              <p className="chart-title">{audience.matches.length > 0 ? "Üst-üstə düşən tarixlər" : "Hələlik üst-üstə düşən tarix yoxdur"}</p>
              <ul className="chips">
                {audience.matches.map((m) => (
                  <li key={m.date} className="chip">
                    {m.date} <span className="chip-count">×{m.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {showSim && (
            <>
              <div className="key-row">
                <KeyNumber label="simulyasiya: qrup">
                  <AnimatedNumber value={sim.groups} format={formatInt} fast={fast} />
                </KeyNumber>
                <KeyNumber label="uyğunluq tezliyi" tone="sim" detail={`dəqiq: ${formatPercent(sim.exact)}`}>
                  <AnimatedNumber value={sim.groups > 0 ? sim.hits / sim.groups : null} format={(v) => formatPercent(v)} fast={fast} />
                </KeyNumber>
              </div>
              <Legend
                items={[
                  { kind: "sim", label: "Simulyasiya" },
                  { kind: "reference", label: "Əks hadisə düsturu" },
                ]}
              />
            </>
          )}
        </>
      }
      takeaway={
        revealed && showAudience
          ? `Əks hadisəni hesablamaq asandır: hamının ad günü fərqli olsun. n = ${n} üçün P = ${formatPercent(exact)} - intuisiyadan qat-qat böyük.`
          : showSim && sim.groups >= 500
            ? `${formatInt(sim.groups)} təsadüfi qrupda tezlik ${formatPercent(sim.hits / sim.groups)}, düstur ${formatPercent(sim.exact)}: əks hadisə düsturu təsdiqlənir.`
            : null
      }
    />
  );
}
