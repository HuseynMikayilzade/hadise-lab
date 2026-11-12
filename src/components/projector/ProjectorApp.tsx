"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXPERIMENTS } from "@/experiments/registry";
import { PROJECTORS } from "@/experiments/registry.projector";
import { EXPERIMENT_IDS, type ExperimentControl, type ExperimentId } from "@/experiments/types";
import { SPEEDS, type Speed } from "@/engine-worker/protocol";
import { useEngine } from "@/engine-worker/useEngine";
import { useVersionedPoll } from "@/components/hooks/useVersionedPoll";
import { adminRequest, type AdminAction } from "@/lib/api-client";
import { DEFAULT_CONTROL, type SessionState } from "@/lib/session/types";
import { EngineControls, type EngineAction } from "./EngineControls";
import { Header, QrDock } from "./Header";
import { PresenterControls, type PresenterAction } from "./PresenterControls";
import { useShortcuts } from "./useShortcuts";

const ADMIN_TOKEN_KEY = "hl:admin-token";

interface ViewResponse {
  version: string;
  control: ExperimentControl;
  view: unknown;
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function ProjectorApp({ code, admin, demo }: { code: string; admin: boolean; demo: boolean }) {
  const presenter = admin || demo;
  const [joinUrl, setJoinUrl] = useState("");
  const [qrLarge, setQrLarge] = useState(!demo);
  const [rehearsalSeed, setRehearsalSeed] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  // Demo rejimi: vəziyyət yalnız bu brauzerdədir, şəbəkə istifadə olunmur.
  const [demoActive, setDemoActive] = useState<ExperimentId | null>("dice");
  const [demoControls, setDemoControls] = useState<Record<ExperimentId, ExperimentControl>>(
    () => Object.fromEntries(EXPERIMENT_IDS.map((id) => [id, { ...DEFAULT_CONTROL, mode: "auto" }])) as Record<ExperimentId, ExperimentControl>,
  );

  const [participants, setParticipants] = useState<number | null>(null);
  const statePoll = useVersionedPoll<SessionState>(demo ? null : `/api/sessions/${code}/state`, 2000, (body) => {
    if (typeof body.participants === "number") setParticipants(body.participants);
  });
  const state = statePoll.data;
  useEffect(() => {
    if (state) setParticipants(state.participants);
  }, [state]);

  const active = demo ? demoActive : (state?.active ?? null);
  const control = active ? (demo ? demoControls[active] : (state?.controls[active] ?? DEFAULT_CONTROL)) : null;
  const mode = control?.mode ?? null;
  const def = active ? EXPERIMENTS[active] : null;
  const client = active ? PROJECTORS[active] : null;

  const wantsAudience = !demo && active !== null && (mode !== "auto" || def?.phoneDuringAuto === "participate");
  const viewPoll = useVersionedPoll<ViewResponse>(wantsAudience ? `/api/sessions/${code}/experiments/${active}/view` : null, 2000);
  const audienceView = viewPoll.data?.view ?? null;

  const engineOn = active !== null && mode !== "audience";
  const engine = useEngine(active, engineOn, rehearsalSeed);
  const snapshot = engineOn ? engine.snapshot : null;

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/j/${code}`);
  }, [code]);

  // Bütün proyektor komponentləri statik idxal olunub; worker hazır olduqda hər şey yüklənib - oflayn işləyir.
  useEffect(() => {
    if (engine.ready) window.__hlPrefetched = true;
  }, [engine.ready]);

  // "Hər ikisi" (və iştirak mümkün olan avtonom) rejimdə yeni auditoriya müşahidələri mühərrikə ötürülür.
  const forwarded = useRef<{ exp: ExperimentId | null; runId: number; view: unknown }>({ exp: null, runId: -1, view: null });
  useEffect(() => {
    if (!active || !client?.forwardAudience || !snapshot || audienceView === null || mode === "audience") return;
    const last = forwarded.current;
    const sameRun = last.exp === active && last.runId === snapshot.runId;
    const outcomes = client.forwardAudience(sameRun ? last.view : null, audienceView);
    forwarded.current = { exp: active, runId: snapshot.runId, view: audienceView };
    if (outcomes.length > 0) engine.send({ type: "audience", exp: active, outcomes });
  }, [active, audienceView, snapshot, client, mode, engine]);

  const runAdmin = useCallback(
    async (action: AdminAction) => {
      let token = readToken();
      if (!token) {
        token = window.prompt("Admin açarını daxil edin")?.trim() ?? "";
        if (!token) return;
      }
      const result = await adminRequest<SessionState>(code, token, action);
      if (!result.ok) {
        if (result.status === 401) {
          try {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
          } catch {
            /* yox */
          }
        }
        setMessage(result.message);
        return;
      }
      try {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
      } catch {
        /* yox */
      }
      setMessage("");
      statePoll.apply(result.data);
      void viewPoll.refresh();
    },
    [code, statePoll, viewPoll],
  );

  const patchDemo = useCallback((exp: ExperimentId, patch: Partial<ExperimentControl>) => {
    setDemoControls((all) => ({ ...all, [exp]: { ...all[exp], ...patch } }));
  }, []);

  const onPresenter = useCallback(
    (action: PresenterAction) => {
      if (action.kind === "select") {
        if (demo) setDemoActive(action.exp);
        else void runAdmin({ action: "setActive", exp: action.exp });
        return;
      }
      if (!active || !control) return;
      const steps = EXPERIMENTS[active].steps ?? 1;
      if (demo) {
        if (action.kind === "reveal") patchDemo(active, { reveal: Math.max(control.reveal, control.step + 1) });
        if (action.kind === "hide") patchDemo(active, { reveal: 0 });
        if (action.kind === "next") patchDemo(active, { step: Math.min(steps - 1, control.step + 1) });
        if (action.kind === "prev") patchDemo(active, { step: Math.max(0, control.step - 1) });
        return;
      }
      switch (action.kind) {
        case "mode":
          return void runAdmin({ action: "setMode", exp: active, mode: action.mode });
        case "toggleOpen":
          return void runAdmin({ action: control.status === "closed" ? "open" : "close", exp: active });
        case "reset":
          if (window.confirm(`"${EXPERIMENTS[active].title}" üzrə bütün cavablar silinsin?`)) void runAdmin({ action: "reset", exp: active });
          return;
        default:
          return void runAdmin({ action: action.kind, exp: active });
      }
    },
    [active, control, demo, patchDemo, runAdmin],
  );

  const onEngine = useCallback(
    (action: EngineAction) => {
      switch (action.kind) {
        case "toggleRun":
          return engine.send({ type: snapshot?.running ? "pause" : "start" });
        case "step":
          return engine.send({ type: "step", trials: 1 });
        case "speed":
          return engine.send({ type: "speed", tps: action.tps });
        case "newTruth":
          return engine.send({ type: "newTruth", seed: rehearsalSeed });
        case "reveal":
          return engine.send({ type: "reveal" });
        case "rehearsal":
          // Məşq: toxumlu generator, toxum ekranda göstərilir. Real çıxışda söndürülməlidir.
          return setRehearsalSeed(action.on ? 1000 + Math.floor(Math.random() * 9000) : null);
      }
    },
    [engine, snapshot, rehearsalSeed],
  );

  const tps = snapshot?.tps ?? 10;
  const changeSpeed = (delta: 1 | -1) => {
    const index = SPEEDS.indexOf(tps as Speed);
    const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, index + delta))];
    engine.send({ type: "speed", tps: next });
  };

  useShortcuts(presenter, {
    ArrowRight: () => {
      const i = active ? EXPERIMENT_IDS.indexOf(active) : -1;
      onPresenter({ kind: "select", exp: EXPERIMENT_IDS[Math.min(EXPERIMENT_IDS.length - 1, i + 1)] });
    },
    ArrowLeft: () => {
      const i = active ? EXPERIMENT_IDS.indexOf(active) : EXPERIMENT_IDS.length;
      onPresenter({ kind: "select", exp: EXPERIMENT_IDS[Math.max(0, i - 1)] });
    },
    r: () => def?.hasReveal && onPresenter({ kind: control && control.reveal > control.step ? "hide" : "reveal" }),
    c: () => onPresenter({ kind: "toggleOpen" }),
    q: () => setQrLarge((v) => !v),
    " ": () => engineOn && onEngine({ kind: "toggleRun" }),
    s: () => engineOn && onEngine({ kind: "step" }),
    "+": () => engineOn && changeSpeed(1),
    "=": () => engineOn && changeSpeed(1),
    "-": () => engineOn && changeSpeed(-1),
    n: () => engineOn && onEngine({ kind: "newTruth" }),
    h: () => engineOn && client?.hasHiddenTruth && onEngine({ kind: "reveal" }),
  });

  const Projector = client?.Projector ?? null;
  const fast = tps >= 100 && Boolean(snapshot?.running);
  const setParam = useCallback((key: string, value: number) => engine.send({ type: "param", key, value }), [engine]);

  const showQrDock = !demo && (qrLarge || active === null);
  const hero = useMemo(() => {
    if (!active || !control || !Projector || !mode) {
      return (
        <div className="lobby">
          <h2>Hadisə laboratoriyası</h2>
          <p>Növbəti eksperiment tezliklə başlayır.</p>
        </div>
      );
    }
    return (
      <Projector
        audience={mode === "auto" ? null : audienceView}
        sim={snapshot?.summary ?? null}
        snapshot={snapshot}
        mode={demo ? "auto" : mode}
        control={control}
        fast={fast}
        presenter={presenter}
        setParam={setParam}
      />
    );
  }, [active, control, Projector, mode, audienceView, snapshot, demo, fast, presenter, setParam]);

  return (
    <div className={`projector ${fast ? "fast" : ""}`}>
      <Header
        joinUrl={joinUrl}
        participants={participants}
        title={def?.title ?? null}
        mode={demo ? (active ? "auto" : null) : mode}
        demo={demo}
        rehearsalSeed={engineOn ? rehearsalSeed : null}
        qrLarge={qrLarge}
        onToggleQr={() => setQrLarge((v) => !v)}
        offline={!demo && (statePoll.failed || viewPoll.failed)}
      />
      <main className="proj-main">
        {hero}
        {showQrDock && <QrDock joinUrl={joinUrl} onClose={() => setQrLarge(false)} />}
        {engine.failure && <p className="notice">{engine.failure}</p>}
      </main>
      <footer className="proj-footer">
        <p className="slide-ref">{def?.slideRef ?? "Hadisələrdə əsas anlayışlar"}</p>
        {message && <p className="notice">{message}</p>}
        {presenter && (
          <div className="control-dock">
            {engineOn && <EngineControls snapshot={snapshot} hasTruth={Boolean(client?.hasHiddenTruth)} rehearsalSeed={rehearsalSeed} onAction={onEngine} />}
            <PresenterControls active={active} control={control} demo={demo} onAction={onPresenter} />
          </div>
        )}
      </footer>
    </div>
  );
}
