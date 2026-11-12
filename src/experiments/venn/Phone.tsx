"use client";

import type { FormEvent } from "react";
import { BlockedCard, FormError, PhoneScreen, PrimaryButton, SuccessCard } from "@/components/phone/PhoneParts";
import { usePhoneSubmit } from "@/components/phone/usePhoneSubmit";
import type { PhoneProps } from "../ui-types";
import { venn, VENN_EVENTS, type Cell } from "./definition";
import { VennDiagram } from "./VennDiagram";

type Draft = { a: boolean | null; b: boolean | null };

const REGION_LABEL: Record<Cell, string> = { both: "A ∩ B", aOnly: "A \\ B", bOnly: "B \\ A", neither: "Ā ∩ B̄" };
const ZERO = { aOnly: 0, bOnly: 0, both: 0, neither: 0 };

export function VennPhone({ code, exp, deviceId, scope, draft, setDraft }: PhoneProps<Draft>) {
  const { receipts, phase, error, setError, blocked, submit } = usePhoneSubmit<{ cell: Cell }>(code, exp, deviceId, scope);
  const value: Draft = draft ?? { a: null, b: null };
  const done = receipts[receipts.length - 1];

  if (done) {
    return (
      <PhoneScreen title={venn.title} instruction="Cavabınız qeydə alındı.">
        <SuccessCard title="Sizin nəticəniz bu bölgəyə düşdü">
          <p className="result-big math">{REGION_LABEL[done.cell]}</p>
          <VennDiagram counts={{ ...ZERO, [done.cell]: 1 }} highlight={[done.cell]} compact />
        </SuccessCard>
      </PhoneScreen>
    );
  }
  if (blocked) return <PhoneScreen title={venn.title} instruction={venn.phoneInstruction}><BlockedCard message={blocked} /></PhoneScreen>;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (value.a === null || value.b === null) {
      setError("Hər iki suala cavab verin.");
      return;
    }
    const receipt = await submit({ a: value.a, b: value.b });
    if (receipt) setDraft(undefined);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="phone-form">
      <PhoneScreen
        title={venn.title}
        instruction={venn.phoneInstruction}
        action={<PrimaryButton type="submit" disabled={phase === "sending"}>{phase === "sending" ? "Göndərilir…" : "Cavabı göndər"}</PrimaryButton>}
      >
        {(["a", "b"] as const).map((key) => (
          <fieldset className="question" key={key}>
            <legend>
              <span className={`event-tag event-${key}`}>{VENN_EVENTS[key].symbol}</span>
              {VENN_EVENTS[key].question}
            </legend>
            <div className="choices two">
              {[true, false].map((option) => (
                <label className="choice" key={String(option)}>
                  <input
                    type="radio"
                    name={key}
                    checked={value[key] === option}
                    onChange={() => {
                      setDraft({ ...value, [key]: option });
                      setError("");
                    }}
                  />
                  <span>{option ? "Bəli" : "Xeyr"}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <FormError message={error} />
      </PhoneScreen>
    </form>
  );
}
