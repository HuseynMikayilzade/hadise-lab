"use client";

import { FormError, PhoneScreen, SuccessCard } from "@/components/phone/PhoneParts";
import { usePhoneSubmit } from "@/components/phone/usePhoneSubmit";
import type { PhoneProps } from "../ui-types";
import { ANSWER_LABELS, eventTypes, optionsFor, QUIZ, type QuizAnswer } from "./definition";

/** Hər sual ayrıca mount olunur: bir sualın "bağlı" vəziyyəti növbətiyə keçmir. */
export function EventTypesPhone(props: PhoneProps<never>) {
  return <QuizStep key={props.control.step} {...props} />;
}

function QuizStep({ code, exp, deviceId, scope, control }: PhoneProps<never>) {
  const { receipts, phase, error, blocked, submit } = usePhoneSubmit<{ item: number; answer: QuizAnswer }>(code, exp, deviceId, scope);
  const step = control.step;
  const item = QUIZ[step];
  const mine = receipts.find((r) => r.item === step);
  const revealed = control.reveal > step;

  if (mine || revealed || blocked) {
    return (
      <PhoneScreen title={eventTypes.title} instruction={`Sual ${step + 1} / ${QUIZ.length}`}>
        <SuccessCard title={mine ? "Cavabınız qeydə alındı" : revealed ? "Cavab artıq göstərilib" : (blocked ?? "")}>
          {mine && <p className="result-big">{ANSWER_LABELS[mine.answer]}</p>}
          {revealed && (
            <p className={mine?.answer === item.answer ? "verdict-ok" : "verdict-info"}>
              Düzgün cavab: <strong>{ANSWER_LABELS[item.answer]}</strong>. {item.explanation}
            </p>
          )}
          {!revealed && <p className="phone-hint">Növbəti sual avtomatik görünəcək.</p>}
        </SuccessCard>
      </PhoneScreen>
    );
  }

  return (
    <PhoneScreen title={eventTypes.title} instruction={`Sual ${step + 1} / ${QUIZ.length}: ${eventTypes.phoneInstruction}`}>
      <p className="quiz-text-phone">{item.prompt}</p>
      <div className="choices stack" role="group" aria-label="Cavab variantları">
        {optionsFor(item).map((o) => (
          <button key={o} type="button" className="choice-button" disabled={phase === "sending"} onClick={() => void submit({ item: step, answer: o })}>
            {ANSWER_LABELS[o]}
          </button>
        ))}
      </div>
      <FormError message={error} />
    </PhoneScreen>
  );
}
