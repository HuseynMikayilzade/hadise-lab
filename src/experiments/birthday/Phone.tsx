"use client";

import { BlockedCard, FormError, PhoneScreen, PrimaryButton, SuccessCard } from "@/components/phone/PhoneParts";
import { usePhoneSubmit } from "@/components/phone/usePhoneSubmit";
import type { PhoneProps } from "../ui-types";
import { birthday, GUESS_OPTIONS, isValidDate, MONTHS, type GuessId } from "./definition";

type Draft = { day: string; month: string; guess: GuessId | null };

export function BirthdayPhone({ code, exp, deviceId, scope, draft, setDraft }: PhoneProps<Draft>) {
  const { receipts, phase, error, setError, blocked, submit } = usePhoneSubmit<{ date: string }>(code, exp, deviceId, scope);
  const value: Draft = draft ?? { day: "", month: "", guess: null };
  const done = receipts[receipts.length - 1];

  if (done) {
    return (
      <PhoneScreen title={birthday.title} instruction="Cavabınız qeydə alındı.">
        <SuccessCard title="Sizin tarixiniz">
          <p className="result-big">{done.date}</p>
          <p className="phone-hint">Yalnız tarix saxlanılır, sizin adınız yox.</p>
        </SuccessCard>
      </PhoneScreen>
    );
  }
  if (blocked) return <PhoneScreen title={birthday.title} instruction={birthday.phoneInstruction}><BlockedCard message={blocked} /></PhoneScreen>;

  async function send() {
    const day = Number(value.day);
    const month = Number(value.month);
    if (!value.guess) return setError("Əvvəlcə təxmininizi seçin.");
    if (!isValidDate(day, month)) return setError("Belə tarix yoxdur. Günü və ayı yoxlayın.");
    if (await submit({ day, month, guess: value.guess })) setDraft(undefined);
  }

  return (
    <PhoneScreen
      title={birthday.title}
      instruction={birthday.phoneInstruction}
      action={
        <PrimaryButton disabled={phase === "sending"} onClick={() => void send()}>
          {phase === "sending" ? "Göndərilir…" : "Göndər"}
        </PrimaryButton>
      }
    >
      <fieldset className="question">
        <legend>1. Otaqda ən azı iki nəfərin ad günü eyni olması ehtimalı nə qədərdir?</legend>
        <div className="choices grid2">
          {GUESS_OPTIONS.map((g) => (
            <label className="choice" key={g.id}>
              <input type="radio" name="guess" checked={value.guess === g.id} onChange={() => setDraft({ ...value, guess: g.id })} />
              <span>{g.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="question">
        <legend>2. Doğum gününüz (yalnız gün və ay)</legend>
        <div className="date-row">
          <label>
            <span className="field-label">Gün</span>
            <input inputMode="numeric" pattern="[0-9]*" maxLength={2} value={value.day} onChange={(e) => setDraft({ ...value, day: e.target.value.replace(/\D/g, "") })} />
          </label>
          <label>
            <span className="field-label">Ay</span>
            <select value={value.month} onChange={(e) => setDraft({ ...value, month: e.target.value })}>
              <option value="">seçin</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      <FormError message={error} />
    </PhoneScreen>
  );
}
