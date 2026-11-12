"use client";

import { BlockedCard, FormError, PhoneScreen, PrimaryButton, SuccessCard } from "@/components/phone/PhoneParts";
import { usePhoneSubmit } from "@/components/phone/usePhoneSubmit";
import { SEQUENCE_LENGTH } from "@/lib/stats/runs";
import type { PhoneProps } from "../ui-types";
import { randomSeq } from "./definition";

export function RandomSeqPhone({ code, exp, deviceId, scope, draft, setDraft }: PhoneProps<string>) {
  const { receipts, phase, error, blocked, submit } = usePhoneSubmit<{ longestRun: number; switches: number }>(code, exp, deviceId, scope);
  const value = draft ?? "";
  const done = receipts[receipts.length - 1];

  if (done) {
    return (
      <PhoneScreen title={randomSeq.title} instruction="Ardıcıllığınız qeydə alındı.">
        <SuccessCard title="Sizin ardıcıllığınız">
          <p className="result-line">
            Ən uzun seriya: <strong>{done.longestRun}</strong>, dəyişmə sayı: <strong>{done.switches}</strong>
          </p>
          <p className="phone-hint">Həqiqi təsadüfdə ən uzun seriya adətən 4-5 olur.</p>
        </SuccessCard>
      </PhoneScreen>
    );
  }
  if (blocked) return <PhoneScreen title={randomSeq.title} instruction={randomSeq.phoneInstruction}><BlockedCard message={blocked} /></PhoneScreen>;

  const add = (c: "G" | "R") => value.length < SEQUENCE_LENGTH && setDraft(value + c);
  const full = value.length === SEQUENCE_LENGTH;

  return (
    <PhoneScreen
      title={randomSeq.title}
      instruction={randomSeq.phoneInstruction}
      action={
        full ? (
          <PrimaryButton disabled={phase === "sending"} onClick={async () => { if (await submit({ sequence: value })) setDraft(undefined); }}>
            {phase === "sending" ? "Göndərilir…" : "Göndər"}
          </PrimaryButton>
        ) : (
          <div className="action-pair">
            <button type="button" className="btn-coin" onClick={() => add("G")}>G</button>
            <button type="button" className="btn-coin" onClick={() => add("R")}>R</button>
          </div>
        )
      }
    >
      <p className="sequence-progress" aria-live="polite">
        {value.length} / {SEQUENCE_LENGTH}
      </p>
      <p className="sequence phone-seq">
        {Array.from({ length: SEQUENCE_LENGTH }, (_, i) => (
          <span key={i} className={value[i] ? (value[i] === "G" ? "flip flip-g" : "flip flip-r") : "flip flip-empty"}>
            {value[i] ?? "·"}
          </span>
        ))}
      </p>
      <button type="button" className="btn-secondary" disabled={value.length === 0} onClick={() => setDraft(value.length > 1 ? value.slice(0, -1) : undefined)}>
        Sonuncunu sil
      </button>
      <FormError message={error} />
    </PhoneScreen>
  );
}
