import { z } from "zod";
import type { Estimate } from "@/lib/probability";
import { decodePoint, encodePoint, estimatePi, insideCircle, randomPoint, type Point } from "@/lib/stats/montecarlo";
import type { ExperimentDefinition } from "../types";
import { createHistory, recordHistory, type History } from "../shared";

export const POINTS_PER_TAP = 100;
export const MAX_DRAWN_POINTS = 2000;

export interface PiView {
  inside: number;
  total: number;
  pi: Estimate | null;
  points: Point[];
}

export interface PiHistoryPoint {
  n: number;
  estimate: number;
  lower: number;
  upper: number;
}

export interface PiModel {
  inside: number;
  total: number;
  /** Son 2000 nöqtənin dairəvi buferi: x, y cütləri. */
  recent: Float64Array;
  cursor: number;
  history: History<PiHistoryPoint>;
}

export interface PiSummary {
  view: PiView;
  history: PiHistoryPoint[];
}

export type PiTypes = {
  input: Record<string, never>;
  receipt: { points: Point[]; inside: number };
  aggregate: { inside: number; total: number; points: Point[] };
  view: PiView;
  truth: null;
  model: PiModel;
  outcome: Point;
  summary: PiSummary;
};

export const monteCarlo: ExperimentDefinition<PiTypes> = {
  id: "monte-carlo",
  title: "Monte Karlo: π-ni tapaq",
  slideRef: "Slayd 14: həndəsi ehtimal",
  phoneInstruction: "Kvadrata 100 təsadüfi nöqtə atın.",
  phoneDuringAuto: "watch",
  inputSchema: z.object({}).strict(),
  perDeviceLimit: 10,
  lists: [{ name: "pts", read: MAX_DRAWN_POINTS }],
  hasReveal: false,

  planSubmission(_input, rng) {
    const points = Array.from({ length: POINTS_PER_TAP }, () => randomPoint(rng));
    const inside = points.filter(insideCircle).length;
    return {
      incr: { inside, total: POINTS_PER_TAP },
      push: [{ list: "pts", items: points.map(encodePoint), cap: MAX_DRAWN_POINTS }],
      receipt: { points, inside },
    };
  },

  decodeAggregate: ({ hash, lists }) => ({
    inside: hash.inside ?? 0,
    total: hash.total ?? 0,
    points: (lists.pts ?? []).map(decodePoint).filter((p): p is Point => p !== null),
  }),

  computeView: ({ inside, total, points }) => ({ inside, total, pi: estimatePi(inside, total), points }),

  engine: {
    drawHiddenTruth: () => null,
    initModel: () => ({ inside: 0, total: 0, recent: new Float64Array(MAX_DRAWN_POINTS * 2), cursor: 0, history: createHistory<PiHistoryPoint>() }),
    runTrial: (_truth, rng) => randomPoint(rng),
    updateModel(model, point) {
      model.total += 1;
      if (insideCircle(point)) model.inside += 1;
      const slot = (model.cursor % MAX_DRAWN_POINTS) * 2;
      model.recent[slot] = point.x;
      model.recent[slot + 1] = point.y;
      model.cursor += 1;
      const est = estimatePi(model.inside, model.total);
      if (est) recordHistory(model.history, { n: model.total, estimate: est.value, lower: est.interval.lower, upper: est.interval.upper });
    },
    summarize(model) {
      const count = Math.min(model.cursor, MAX_DRAWN_POINTS);
      const points: Point[] = [];
      for (let i = 0; i < count; i += 1) points.push({ x: model.recent[i * 2], y: model.recent[i * 2 + 1] });
      return {
        view: { inside: model.inside, total: model.total, pi: estimatePi(model.inside, model.total), points },
        history: model.history.points.slice(),
      };
    },
  },
};
