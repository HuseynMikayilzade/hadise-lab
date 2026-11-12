import type { EngineParams, ExperimentId } from "@/experiments/types";

export const SPEEDS = [1, 10, 100, 1000] as const;
export type Speed = (typeof SPEEDS)[number];

/** UI → Worker */
export type ToWorker =
  | { type: "init"; exp: ExperimentId; seed: number | null }
  | { type: "start" }
  | { type: "pause" }
  | { type: "step"; trials: number }
  | { type: "speed"; tps: Speed }
  | { type: "newTruth"; seed: number | null }
  | { type: "reveal" }
  | { type: "param"; key: string; value: number }
  | { type: "audience"; exp: ExperimentId; outcomes: unknown[] };

export interface EngineSnapshot<Summary = unknown> {
  exp: ExperimentId;
  /** Hər yeni gizli həqiqətdə artır. */
  runId: number;
  running: boolean;
  tps: Speed;
  trials: number;
  seed: number | null;
  params: EngineParams;
  /** Həqiqət yalnız "reveal"dən sonra xülasəyə daxil edilir. */
  revealed: boolean;
  summary: Summary;
}

/** Worker → UI */
export type FromWorker =
  | { type: "ready" }
  | { type: "snapshot"; snapshot: EngineSnapshot }
  | { type: "error"; message: string };

/** Göstəriş yeniləmə tezliyi: ən çox 10 kadr/s. */
export const TICK_MS = 100;
