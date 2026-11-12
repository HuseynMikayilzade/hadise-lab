"use client";

import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { BarChart } from "@/components/charts/BarChart";
import { KeyNumber, Stage } from "@/components/projector/Stage";
import { formatInt, formatPercent } from "@/lib/format";
import type { ProjectorProps } from "../ui-types";
import { ANSWER_LABELS, optionsFor, QUIZ, type EventTypesSummary, type GeneratedExample, type QuizItem, type QuizView } from "./definition";
import { OmegaTokens } from "./OmegaTokens";

const setText = (s: readonly number[]) => (s.length === 0 ? "∅" : `{${s.join(", ")}}`);

function ItemVisual({ item }: { item: QuizItem }) {
  return item.kind === "single" ? (
    <OmegaTokens a={item.event} label={`Hadisə: ${setText(item.event)}`} />
  ) : (
    <OmegaTokens a={item.a.set} b={item.b.set} label={`A = ${setText(item.a.set)}, B = ${setText(item.b.set)}`} />
  );
}

function QuizPanel({ view, step, revealed }: { view: QuizView | null; step: number; revealed: boolean }) {
  const item = QUIZ[step];
  const dist = view?.distributions[step];
  const options = optionsFor(item);
  const n = dist ? options.reduce((s, o) => s + dist[o], 0) : 0;
  return (
    <div className="hero-split">
      <div className="quiz-prompt">
        <p className="quiz-number">Sual {step + 1} / {QUIZ.length}</p>
        <p className="quiz-text">{item.prompt}</p>
        {revealed && <ItemVisual item={item} />}
      </div>
      <BarChart
        ariaLabel="Cavabların paylanması"
        yMax={1}
        yFormat={(v) => formatPercent(v, 0)}
        valueFormat={(v) => formatPercent(v, 0)}
        groups={options.map((o) => ({
          id: o,
          label: ANSWER_LABELS[o],
          bars: [
            {
              id: o,
              label: ANSWER_LABELS[o],
              value: n > 0 && dist ? dist[o] / n : 0,
              color: revealed && o === item.answer ? "var(--correct)" : "var(--series-audience)",
              highlight: revealed && o === item.answer,
            },
          ],
        }))}
      />
      <p className="sr-only" aria-live="polite">
        {formatInt(n)} cavab
      </p>
    </div>
  );
}

function GeneratedPanel({ example }: { example: GeneratedExample }) {
  return (
    <div className="generated">
      <div>
        <p className="chart-title">Təsadüfi hadisə: {setText(example.event)}</p>
        <OmegaTokens a={example.event} label={`Təsadüfi hadisə ${setText(example.event)}`} />
        <p className="classified">
          Növü: <strong>{ANSWER_LABELS[example.eventKind]}</strong>
        </p>
      </div>
      <div>
        <p className="chart-title">
          A = {setText(example.a)}, B = {setText(example.b)}
        </p>
        <OmegaTokens a={example.a} b={example.b} label={`A = ${setText(example.a)}, B = ${setText(example.b)}`} />
        <p className="classified">
          A ∩ B = {setText(example.a.filter((x) => example.b.includes(x)))}: <strong>{ANSWER_LABELS[example.pairKind]}</strong>
        </p>
      </div>
    </div>
  );
}

export function EventTypesProjector({ audience, sim, mode, control, fast }: ProjectorProps<QuizView, EventTypesSummary>) {
  const step = control.step;
  const revealed = control.reveal > step;
  const item = QUIZ[step];
  const showQuiz = mode !== "auto" || audience !== null;
  const showSim = mode !== "audience" && sim?.latest;

  const hero =
    showSim && mode === "auto" ? (
      <GeneratedPanel example={sim.latest!} />
    ) : (
      <QuizPanel view={audience} step={step} revealed={revealed} />
    );

  return (
    <Stage
      instruction={mode === "auto" ? "Ω = {1, ..., 6}: kompüter təsadüfi hadisələr yaradır və növünü təyin edir." : "Telefonda hadisənin növünü seçin."}
      hero={hero}
      side={
        <>
          {showQuiz && revealed && (
            <KeyNumber label="Düzgün cavab" tone="correct" detail={item.explanation}>
              {ANSWER_LABELS[item.answer]}
            </KeyNumber>
          )}
          {showSim && sim && (
            <>
              {mode === "both" && <GeneratedPanel example={sim.latest!} />}
              <div className="key-row">
                <KeyNumber label="yaradılmış hadisə">
                  <AnimatedNumber value={sim.generated} format={formatInt} fast={fast} />
                </KeyNumber>
              </div>
              <ul className="kind-counts">
                {(["yeqin", "mumkunsuz", "tesadufi"] as const).map((k) => (
                  <li key={k}>
                    <span>{ANSWER_LABELS[k]}</span>
                    <span className="num">{formatPercent(sim.generated > 0 ? sim.eventKinds[k] / sim.generated : 0, 0)}</span>
                  </li>
                ))}
                {(["birge", "birge-olmayan"] as const).map((k) => (
                  <li key={k}>
                    <span>{ANSWER_LABELS[k]}</span>
                    <span className="num">{formatPercent(sim.generated > 0 ? sim.pairKinds[k] / sim.generated : 0, 0)}</span>
                  </li>
                ))}
              </ul>
              <p className="detail-line">Qayda: boş çoxluq mümkünsüz, Ω-nın özü yəqin, qalanları təsadüfi hadisədir. A ∩ B ≠ ∅ olduqda hadisələr birgədir.</p>
            </>
          )}
        </>
      }
      takeaway={revealed ? item.explanation : null}
    />
  );
}
