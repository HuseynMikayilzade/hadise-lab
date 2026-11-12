import { z } from "zod";
import { chiSquareGof, type ChiSquareResult } from "@/lib/engine/chisq";
import { betaMean, credibleInterval, dirichletFromCounts, dirichletMarginal } from "@/lib/engine/conjugate";
import { categorical, dirichlet } from "@/lib/engine/samplers";
import { wilsonInterval, type Estimate } from "@/lib/probability";
import type { ExperimentDefinition } from "../types";
import { createHistory, recordHistory, sum, type History } from "../shared";

export const SEASONS = [
  { id: "qis", label: "Qış" },
  { id: "yaz", label: "Yaz" },
  { id: "yay", label: "Yay" },
  { id: "payiz", label: "Payız" },
] as const;

export type SeasonId = (typeof SEASONS)[number]["id"];
const SEASON_IDS = SEASONS.map((s) => s.id) as [SeasonId, ...SeasonId[]];
const UNIFORM = SEASONS.map(() => 0.25);

export interface SeasonsView {
  counts: number[];
  n: number;
  shares: (Estimate | null)[];
  chi: ChiSquareResult;
}

export function seasonsView(counts: number[]): SeasonsView {
  const n = sum(counts);
  return {
    counts,
    n,
    shares: counts.map((c) => {
      const interval = wilsonInterval(c, n);
      return interval ? { value: c / n, interval } : null;
    }),
    chi: chiSquareGof(counts, UNIFORM),
  };
}

export interface SeasonsTruth {
  probabilities: number[];
  nearUniform: boolean;
}

export interface SeasonsModel {
  counts: number[];
  history: History<{ n: number; counts: number[] }>;
}

export interface SeasonsSummary {
  view: SeasonsView;
  posteriors: Estimate[];
  history: { n: number; counts: number[] }[];
  truth: SeasonsTruth | null;
}

export type SeasonsTypes = {
  input: { season: SeasonId };
  receipt: { season: SeasonId };
  aggregate: number[];
  view: SeasonsView;
  truth: SeasonsTruth;
  model: SeasonsModel;
  outcome: number;
  summary: SeasonsSummary;
};

export const seasons: ExperimentDefinition<SeasonsTypes> = {
  id: "seasons",
  title: "Fəsillər: tam qrup",
  slideRef: "Slayd 8, 15-17: tam qrup, bərabər imkanlı hadisələr, Kolmoqorov aksiomları",
  phoneInstruction: "Hansı fəsildə doğulmusunuz?",
  phoneDuringAuto: "watch",
  inputSchema: z.object({ season: z.enum(SEASON_IDS) }),
  perDeviceLimit: 1,
  lists: [],
  hasReveal: false,

  planSubmission: ({ season }) => ({ incr: { [season]: 1 }, receipt: { season } }),
  decodeAggregate: ({ hash }) => SEASON_IDS.map((id) => hash[id] ?? 0),
  computeView: (counts) => seasonsView(counts),

  engine: {
    drawHiddenTruth(rng) {
      // Yarı ehtimalla demək olar ki bərabər (Dirichlet(200)), əks halda nəzərəçarpan fərqli (Dirichlet(2)).
      const nearUniform = rng.next() < 0.5;
      return { nearUniform, probabilities: dirichlet(rng, UNIFORM.map(() => (nearUniform ? 200 : 2))) };
    },
    initModel: () => ({ counts: [0, 0, 0, 0], history: createHistory() }),
    runTrial: (truth, rng) => categorical(rng, truth.probabilities),
    updateModel(model, index) {
      model.counts[index] += 1;
      recordHistory(model.history, { n: sum(model.counts), counts: model.counts.slice() });
    },
    summarize(model, truth) {
      const alphas = dirichletFromCounts(model.counts);
      return {
        view: seasonsView(model.counts.slice()),
        posteriors: SEASONS.map((_, i) => {
          const m = dirichletMarginal(alphas, i);
          return { value: betaMean(m), interval: credibleInterval(m) };
        }),
        history: model.history.points.slice(),
        truth,
      };
    },
  },
};
