import { z } from "zod";
import { chiSquareGof, type ChiSquareResult } from "@/lib/engine/chisq";
import { dirichletFromCounts, dirichletMarginal, betaMean, credibleInterval } from "@/lib/engine/conjugate";
import { categorical, dirichlet } from "@/lib/engine/samplers";
import type { Estimate } from "@/lib/probability";
import { wilsonInterval } from "@/lib/probability";
import type { ExperimentDefinition } from "../types";
import { createHistory, recordHistory, sum, type History } from "../shared";

export const FACES = [1, 2, 3, 4, 5, 6] as const;
const FAIR = FACES.map(() => 1 / 6);

/** Proyektorda seçilə bilən hadisələr - Ω = {1, ..., 6}-nın alt çoxluqları. */
export const DICE_EVENTS = [
  { id: "even", label: "A = cüt xal", faces: [2, 4, 6] },
  { id: "gt4", label: "B = 4-dən çox", faces: [5, 6] },
  { id: "six", label: "C = 6 xal", faces: [6] },
  { id: "le2", label: "D = 2-dən çox deyil", faces: [1, 2] },
] as const;

export type DiceEventId = (typeof DICE_EVENTS)[number]["id"];

export interface DiceView {
  counts: number[];
  n: number;
  frequencies: (Estimate | null)[];
  chi: ChiSquareResult;
}

export function diceView(counts: number[]): DiceView {
  const n = sum(counts);
  return {
    counts,
    n,
    frequencies: counts.map((c) => {
      const interval = wilsonInterval(c, n);
      return interval ? { value: c / n, interval } : null;
    }),
    chi: chiSquareGof(counts, FAIR),
  };
}

export interface DiceTruth {
  probabilities: number[];
  fair: boolean;
}

export interface DiceHistoryPoint {
  n: number;
  counts: number[];
}

export interface DiceModel {
  counts: number[];
  history: History<DiceHistoryPoint>;
}

export interface DiceSummary {
  view: DiceView;
  posteriors: Estimate[];
  history: DiceHistoryPoint[];
  truth: DiceTruth | null;
}

export type DiceTypes = {
  input: Record<string, never>;
  receipt: { face: number };
  aggregate: number[];
  view: DiceView;
  truth: DiceTruth;
  model: DiceModel;
  outcome: number;
  summary: DiceSummary;
};

export const dice: ExperimentDefinition<DiceTypes> = {
  id: "dice",
  title: "Zər laboratoriyası",
  slideRef: "Slayd 4-6, 13-14: sınaq, Ω, klassik və statistik tərif",
  phoneInstruction: "Zəri atın - hər atış serverdə təsadüfi yaranır.",
  phoneDuringAuto: "watch",
  inputSchema: z.object({}).strict(),
  perDeviceLimit: 20,
  lists: [],
  hasReveal: false,

  planSubmission(_input, rng) {
    const face = rng.int(6) + 1;
    return { incr: { [`f${face}`]: 1 }, receipt: { face } };
  },

  decodeAggregate: ({ hash }) => FACES.map((f) => hash[`f${f}`] ?? 0),
  computeView: (counts) => diceView(counts),

  engine: {
    drawHiddenTruth(rng) {
      // Yarı ehtimalla düzgün zər; əks halda üzlərin ehtimalları Dirichlet(3, ..., 3)-dən çəkilir.
      const fair = rng.next() < 0.5;
      return { fair, probabilities: fair ? FAIR.slice() : dirichlet(rng, FACES.map(() => 3)) };
    },
    initModel: () => ({ counts: FACES.map(() => 0), history: createHistory<DiceHistoryPoint>() }),
    runTrial: (truth, rng) => categorical(rng, truth.probabilities) + 1,
    updateModel(model, face) {
      model.counts[face - 1] += 1;
      recordHistory(model.history, { n: sum(model.counts), counts: model.counts.slice() });
    },
    summarize(model, truth) {
      const alphas = dirichletFromCounts(model.counts);
      return {
        view: diceView(model.counts.slice()),
        posteriors: FACES.map((_, i) => {
          const marginal = dirichletMarginal(alphas, i);
          return { value: betaMean(marginal), interval: credibleInterval(marginal) };
        }),
        history: model.history.points.slice(),
        truth,
      };
    },
  },
};

export function eventCount(counts: readonly number[], faces: readonly number[]): number {
  return faces.reduce((s, f) => s + counts[f - 1], 0);
}
