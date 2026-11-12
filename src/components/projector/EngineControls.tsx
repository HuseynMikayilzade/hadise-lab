"use client";

import { SPEEDS, type EngineSnapshot, type Speed } from "@/engine-worker/protocol";
import { formatInt } from "@/lib/format";

export type EngineAction =
  | { kind: "toggleRun" }
  | { kind: "step" }
  | { kind: "speed"; tps: Speed }
  | { kind: "newTruth" }
  | { kind: "reveal" }
  | { kind: "rehearsal"; on: boolean };

/** Avtonom rejimin idarəsi: Başlat / Dayandır, Bir addım, sürət, Yenidən başlat, Gizli parametri göstər. */
export function EngineControls({
  snapshot,
  hasTruth,
  rehearsalSeed,
  onAction,
}: {
  snapshot: EngineSnapshot | null;
  hasTruth: boolean;
  rehearsalSeed: number | null;
  onAction: (action: EngineAction) => void;
}) {
  const running = snapshot?.running ?? false;
  const tps = snapshot?.tps ?? 10;
  return (
    <div className="controls engine-controls" role="group" aria-label="Avtonom rejim">
      <button type="button" className="ctl ctl-primary" onClick={() => onAction({ kind: "toggleRun" })} aria-keyshortcuts="Space">
        {running ? "Dayandır" : "Başlat"}
      </button>
      <button type="button" className="ctl" onClick={() => onAction({ kind: "step" })} aria-keyshortcuts="S">
        Bir addım
      </button>
      <div className="segmented small" role="radiogroup" aria-label="Sürət (sınaq/saniyə)">
        {SPEEDS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={tps === s} className={tps === s ? "active" : ""} onClick={() => onAction({ kind: "speed", tps: s })}>
            {formatInt(s)}/s
          </button>
        ))}
      </div>
      <button type="button" className="ctl" onClick={() => onAction({ kind: "newTruth" })} aria-keyshortcuts="N">
        Yenidən başlat
      </button>
      {hasTruth && (
        <button type="button" className="ctl" disabled={snapshot?.revealed} onClick={() => onAction({ kind: "reveal" })} aria-keyshortcuts="H">
          Gizli parametri göstər
        </button>
      )}
      <label className="ctl ctl-check">
        <input type="checkbox" checked={rehearsalSeed !== null} onChange={(e) => onAction({ kind: "rehearsal", on: e.target.checked })} />
        Məşq
      </label>
    </div>
  );
}
