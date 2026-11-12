"use client";

import { BlockedCard, FormError, PhoneScreen, PrimaryButton } from "@/components/phone/PhoneParts";
import { usePhoneSubmit } from "@/components/phone/usePhoneSubmit";
import type { PhoneProps } from "../ui-types";
import { dice, FACES } from "./definition";
import { DieFace } from "./DieFace";

export function DicePhone({ code, exp, deviceId, scope }: PhoneProps<never>) {
  const { receipts, phase, error, blocked, submit } = usePhoneSubmit<{ face: number }>(code, exp, deviceId, scope);
  const left = dice.perDeviceLimit - receipts.length;
  const last = receipts[receipts.length - 1];
  const tally = FACES.map((f) => receipts.filter((r) => r.face === f).length);

  return (
    <PhoneScreen
      title={dice.title}
      instruction={dice.phoneInstruction}
      action={
        left > 0 && !blocked ? (
          <PrimaryButton disabled={phase === "sending"} onClick={() => void submit({})}>
            {phase === "sending" ? "Atılır…" : `Zəri at (${left} qaldı)`}
          </PrimaryButton>
        ) : undefined
      }
    >
      <div className="die-stage" aria-live="polite">
        {last ? <DieFace key={receipts.length} value={last.face} size={140} rolling /> : <p className="phone-hint">Hələ atış yoxdur.</p>}
        {last && <p className="result-line">Sizin atışınız: <strong>{last.face}</strong> xal</p>}
      </div>
      {receipts.length > 0 && (
        <ul className="tally" aria-label="Sizin atışlarınız">
          {FACES.map((f, i) => (
            <li key={f}>
              <span className="tally-face">{f}</span>
              <span className="tally-count">{tally[i]}</span>
            </li>
          ))}
        </ul>
      )}
      {(left <= 0 || blocked) && <BlockedCard message={blocked ?? "20 atışınızın hamısı qeydə alındı"} />}
      <FormError message={error} />
    </PhoneScreen>
  );
}
