"use client";

import { BlockedCard, FormError, PhoneScreen, PrimaryButton, SuccessCard } from "@/components/phone/PhoneParts";
import { usePhoneSubmit } from "@/components/phone/usePhoneSubmit";
import type { PhoneProps } from "../ui-types";
import { bayesTest } from "./definition";
import { SCENARIO_TEXT } from "./scenario";

export function BayesPhone({ code, exp, deviceId, scope, draft, setDraft }: PhoneProps<number>) {
  const { receipts, phase, error, blocked, submit } = usePhoneSubmit<{ guess: number }>(code, exp, deviceId, scope);
  const done = receipts[receipts.length - 1];
  const value = draft ?? 50;

  if (done) {
    return (
      <PhoneScreen title={bayesTest.title} instruction="Təxmininiz qeydə alındı.">
        <SuccessCard title="Sizin təxmininiz">
          <p className="result-big">{done.guess}%</p>
          <p className="phone-hint">Düzgün cavabı təqdimatçı açacaq.</p>
        </SuccessCard>
      </PhoneScreen>
    );
  }
  if (blocked) return <PhoneScreen title={bayesTest.title} instruction={bayesTest.phoneInstruction}><BlockedCard message={blocked} /></PhoneScreen>;

  return (
    <PhoneScreen
      title={bayesTest.title}
      instruction={bayesTest.phoneInstruction}
      action={
        <PrimaryButton
          disabled={phase === "sending"}
          onClick={async () => {
            if (await submit({ guess: value })) setDraft(undefined);
          }}
        >
          {phase === "sending" ? "Göndərilir…" : `${value}% göndər`}
        </PrimaryButton>
      }
    >
      <p className="scenario-phone">{SCENARIO_TEXT}</p>
      <label className="slider">
        <span className="slider-value">{value}%</span>
        <input type="range" min={0} max={100} step={1} value={value} onChange={(e) => setDraft(Number(e.target.value))} aria-label="Xəstə olma ehtimalı (%)" />
        <span className="slider-scale">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </span>
      </label>
      <FormError message={error} />
    </PhoneScreen>
  );
}
