"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EXPERIMENTS } from "@/experiments/registry";
import { PHONES } from "@/experiments/registry.phone";
import type { ExperimentId } from "@/experiments/types";
import { useVersionedPoll } from "@/components/hooks/useVersionedPoll";
import { joinSession } from "@/lib/api-client";
import { getDeviceId } from "@/lib/device";
import type { SessionState } from "@/lib/session/types";

/**
 * Telefon: bir QR skanı bütün çıxış üçün. Sessiya vəziyyəti ~2,5 s-dən bir sorğulanır və
 * aktiv eksperiment avtomatik açılır. Göndərilməmiş cavab varsa, ekran qəfil dəyişmir -
 * "Eksperiment dəyişdi" bildirişi göstərilir.
 */
export function PhoneApp({ code }: { code: string }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const { data: state, failed } = useVersionedPoll<SessionState>(`/api/sessions/${code}/state`, 2500);
  const drafts = useRef(new Map<ExperimentId, unknown>());
  const [, force] = useState(0);
  const [shown, setShown] = useState<ExperimentId | null>(null);

  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);
    void joinSession(code, id);
  }, [code]);

  const active = state?.active ?? null;
  const dirty = shown !== null && drafts.current.get(shown) !== undefined;
  const pendingSwitch = state !== null && active !== shown && dirty;

  // Göndərilməmiş cavab yoxdursa, aktiv eksperimentə avtomatik keçid.
  useEffect(() => {
    if (state && active !== shown && !dirty) setShown(active);
  }, [state, active, shown, dirty]);

  const setDraft = useCallback(
    (exp: ExperimentId) => (draft: unknown) => {
      if (draft === undefined) drafts.current.delete(exp);
      else drafts.current.set(exp, draft);
      force((n) => n + 1);
    },
    [],
  );

  if (!state || !deviceId) {
    return (
      <main className="phone">
        <div className="phone-screen center">
          <h1>Hadisə laboratoriyası</h1>
          <p className="phone-hint">{failed ? "Bağlantı yoxdur. Yenidən cəhd edilir…" : "Qoşulur…"}</p>
        </div>
      </main>
    );
  }

  const control = shown ? state.controls[shown] : null;
  const def = shown ? EXPERIMENTS[shown] : null;
  const Phone = shown ? PHONES[shown] : null;
  const watching = def && control && control.mode === "auto" && def.phoneDuringAuto === "watch";

  return (
    <main className="phone">
      {pendingSwitch && (
        <div className="switch-banner" role="status">
          <p>Eksperiment dəyişdi{active ? `: ${EXPERIMENTS[active].title}` : ""}.</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              if (shown) drafts.current.delete(shown);
              setShown(active);
            }}
          >
            Davam et
          </button>
        </div>
      )}
      <div className="phone-stage" key={shown ?? "wait"}>
        {!shown || !def || !control || !Phone ? (
          <div className="phone-screen center">
            <h1>Növbəti eksperimenti gözləyin</h1>
            <p className="phone-hint">Bu səhifəni açıq saxlayın - eksperiment başlayanda özü açılacaq.</p>
          </div>
        ) : watching ? (
          <div className="phone-screen center">
            <h1>{def.title}</h1>
            <p className="phone-instruction">Bu eksperiment avtonom işləyir - ekrana baxın.</p>
          </div>
        ) : (
          <Phone
            code={code}
            exp={shown}
            deviceId={deviceId}
            control={control}
            scope={`${code}:${shown}:${state.generation}.${control.epoch}`}
            draft={drafts.current.get(shown)}
            setDraft={setDraft(shown)}
          />
        )}
      </div>
      {failed && <p className="offline-note">Bağlantı zəifdir - cavablar bağlantı bərpa olunanda göndərilə bilər.</p>}
    </main>
  );
}
