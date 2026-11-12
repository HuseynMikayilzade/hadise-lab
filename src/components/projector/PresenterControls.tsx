"use client";

import { EXPERIMENTS } from "@/experiments/registry";
import { EXPERIMENT_IDS, RUN_MODE_LABELS, type ExperimentControl, type ExperimentId, type RunMode } from "@/experiments/types";

export type PresenterAction =
  | { kind: "select"; exp: ExperimentId | null }
  | { kind: "mode"; mode: RunMode }
  | { kind: "toggleOpen" }
  | { kind: "reveal" }
  | { kind: "hide" }
  | { kind: "next" }
  | { kind: "prev" }
  | { kind: "reset" };

const MODES: readonly RunMode[] = ["audience", "auto", "both"];

/** Təqdimatçı idarəsi (yalnız ?admin və ya ?demo): kiçik, aşağı sağ küncdə. */
export function PresenterControls({
  active,
  control,
  demo,
  onAction,
}: {
  active: ExperimentId | null;
  control: ExperimentControl | null;
  demo: boolean;
  onAction: (action: PresenterAction) => void;
}) {
  const def = active ? EXPERIMENTS[active] : null;
  const steps = def?.steps ?? 1;
  return (
    <div className="controls" role="group" aria-label="Təqdimatçı idarəsi">
      <label className="control-select">
        <span className="sr-only">Eksperiment</span>
        <select value={active ?? ""} onChange={(e) => onAction({ kind: "select", exp: (e.target.value || null) as ExperimentId | null })}>
          <option value="">Gözləmə ekranı</option>
          {EXPERIMENT_IDS.map((id, i) => (
            <option key={id} value={id}>
              {i + 1}. {EXPERIMENTS[id].title}
            </option>
          ))}
        </select>
      </label>
      {active && control && (
        <>
          {!demo && (
            <div className="segmented small" role="radiogroup" aria-label="Rejim">
              {MODES.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={control.mode === m} className={control.mode === m ? "active" : ""} onClick={() => onAction({ kind: "mode", mode: m })}>
                  {RUN_MODE_LABELS[m]}
                </button>
              ))}
            </div>
          )}
          {!demo && (
            <button type="button" className="ctl" onClick={() => onAction({ kind: "toggleOpen" })}>
              {control.status === "closed" ? "Aç" : "Bağla"}
            </button>
          )}
          {def?.hasReveal &&
            (control.reveal > control.step ? (
              <button type="button" className="ctl" onClick={() => onAction({ kind: "hide" })}>
                Cavabı gizlət
              </button>
            ) : (
              <button type="button" className="ctl ctl-primary" onClick={() => onAction({ kind: "reveal" })}>
                Cavabı göstər
              </button>
            ))}
          {steps > 1 && (
            <>
              <button type="button" className="ctl" disabled={control.step === 0} onClick={() => onAction({ kind: "prev" })}>
                Əvvəlki sual
              </button>
              <button type="button" className="ctl" disabled={control.step >= steps - 1} onClick={() => onAction({ kind: "next" })}>
                Növbəti sual
              </button>
            </>
          )}
          {!demo && (
            <button type="button" className="ctl ctl-quiet" onClick={() => onAction({ kind: "reset" })}>
              Sıfırla
            </button>
          )}
        </>
      )}
    </div>
  );
}
