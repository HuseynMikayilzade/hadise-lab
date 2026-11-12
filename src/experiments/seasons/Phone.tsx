"use client";

import { BlockedCard, FormError, PhoneScreen, SuccessCard } from "@/components/phone/PhoneParts";
import { usePhoneSubmit } from "@/components/phone/usePhoneSubmit";
import type { PhoneProps } from "../ui-types";
import { SEASONS, seasons, type SeasonId } from "./definition";

export function SeasonsPhone({ code, exp, deviceId, scope }: PhoneProps<never>) {
  const { receipts, phase, error, blocked, submit } = usePhoneSubmit<{ season: SeasonId }>(code, exp, deviceId, scope);
  const done = receipts[receipts.length - 1];

  if (done) {
    const label = SEASONS.find((s) => s.id === done.season)?.label ?? "";
    return (
      <PhoneScreen title={seasons.title} instruction="Cavabınız qeydə alındı.">
        <SuccessCard title="Sizin hadisəniz">
          <p className="result-big">{label}</p>
          <p className="phone-hint">Siz Ω-nın bu hissəsindəsiniz - dörd hissə birlikdə bütün Ω-dır.</p>
        </SuccessCard>
      </PhoneScreen>
    );
  }
  if (blocked) return <PhoneScreen title={seasons.title} instruction={seasons.phoneInstruction}><BlockedCard message={blocked} /></PhoneScreen>;

  return (
    <PhoneScreen title={seasons.title} instruction={seasons.phoneInstruction}>
      <div className="choices grid2" role="group" aria-label="Fəsillər">
        {SEASONS.map((s, i) => (
          <button key={s.id} type="button" className={`choice-button season-${i + 1}`} disabled={phase === "sending"} onClick={() => void submit({ season: s.id })}>
            {s.label}
          </button>
        ))}
      </div>
      <FormError message={error} />
    </PhoneScreen>
  );
}
