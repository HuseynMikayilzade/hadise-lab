import { z } from "zod";
import {
  assessIndependence,
  computeStats,
  type EventCounts,
  type ExperimentStats,
  type IndependenceVerdict,
} from "@/lib/probability";
import { estimateOddsRatio, jointFromOddsRatio, type JointDistribution, type OddsRatioEstimate } from "@/lib/engine/oddsRatio";
import { categorical, uniform } from "@/lib/engine/samplers";
import type { ExperimentDefinition } from "../types";
import { createHistory, dualEstimate, recordHistory, type DualEstimate, type History } from "../shared";

export const VENN_EVENTS = {
  a: { symbol: "A", question: "Bu gün qəhvə və ya çay içmisən?", short: "qəhvə və ya çay" },
  b: { symbol: "B", question: "Gecə 7 saatdan az yatmısan?", short: "7 saatdan az yuxu" },
} as const;

export type Cell = keyof EventCounts;
const CELLS: readonly Cell[] = ["both", "aOnly", "bOnly", "neither"];

export function cellOf(a: boolean, b: boolean): Cell {
  if (a && b) return "both";
  if (a) return "aOnly";
  if (b) return "bOnly";
  return "neither";
}

export interface VennView {
  counts: EventCounts;
  stats: ExperimentStats;
  verdict: IndependenceVerdict;
  oddsRatio: OddsRatioEstimate | null;
  aGivenB: DualEstimate;
  aGivenNotB: DualEstimate;
}

export function vennView(counts: EventCounts): VennView {
  const stats = computeStats(counts);
  return {
    counts,
    stats,
    verdict: assessIndependence(stats),
    oddsRatio: estimateOddsRatio(counts),
    aGivenB: dualEstimate(counts.both, counts.both + counts.bOnly),
    aGivenNotB: dualEstimate(counts.aOnly, counts.aOnly + counts.neither),
  };
}

export interface VennTruth {
  pA: number;
  pB: number;
  oddsRatio: number;
  independent: boolean;
  joint: JointDistribution;
}

export interface VennHistoryPoint {
  n: number;
  aGivenB: number | null;
  aGivenNotB: number | null;
  logOr: number | null;
}

export interface VennModel {
  counts: EventCounts;
  history: History<VennHistoryPoint>;
}

export interface VennSummary {
  view: VennView;
  history: VennHistoryPoint[];
  truth: (VennTruth & { aGivenB: number; aGivenNotB: number }) | null;
}

export type VennTypes = {
  input: { a: boolean; b: boolean };
  receipt: { cell: Cell };
  aggregate: EventCounts;
  view: VennView;
  truth: VennTruth;
  model: VennModel;
  outcome: Cell;
  summary: VennSummary;
};

export const venn: ExperimentDefinition<VennTypes> = {
  id: "venn",
  title: "Canlı Venn",
  slideRef: "Slayd 9-12, 18-21: əməllər, aksiomlardan nəticələr, şərti ehtimal",
  phoneInstruction: "İki suala cavab verin - hər cavab bir sınaqdır.",
  phoneDuringAuto: "watch",
  inputSchema: z.object({ a: z.boolean(), b: z.boolean() }),
  perDeviceLimit: 1,
  lists: [],
  hasReveal: false,

  planSubmission({ a, b }) {
    const cell = cellOf(a, b);
    return { incr: { [cell]: 1 }, receipt: { cell } };
  },

  decodeAggregate({ hash }) {
    return { aOnly: hash.aOnly ?? 0, bOnly: hash.bOnly ?? 0, both: hash.both ?? 0, neither: hash.neither ?? 0 };
  },

  computeView: (counts) => vennView(counts),

  engine: {
    drawHiddenTruth(rng) {
      const pA = uniform(rng, 0.2, 0.8);
      const pB = uniform(rng, 0.2, 0.8);
      const independent = rng.next() < 0.4;
      // Asılılıq gücü: log(OR) ∈ ±[0,7; 2] - həm müsbət, həm mənfi asılılıq mümkündür.
      const magnitude = uniform(rng, 0.7, 2);
      const oddsRatio = independent ? 1 : Math.exp(rng.next() < 0.5 ? magnitude : -magnitude);
      return { pA, pB, oddsRatio, independent, joint: jointFromOddsRatio(pA, pB, oddsRatio) };
    },
    initModel: () => ({ counts: { aOnly: 0, bOnly: 0, both: 0, neither: 0 }, history: createHistory<VennHistoryPoint>() }),
    runTrial(truth, rng) {
      const j = truth.joint;
      return CELLS[categorical(rng, [j.both, j.aOnly, j.bOnly, j.neither])];
    },
    updateModel(model, cell) {
      model.counts[cell] += 1;
      const c = model.counts;
      const n = c.both + c.aOnly + c.bOnly + c.neither;
      const bTotal = c.both + c.bOnly;
      const notBTotal = c.aOnly + c.neither;
      const or = estimateOddsRatio(c);
      recordHistory(model.history, {
        n,
        aGivenB: bTotal > 0 ? c.both / bTotal : null,
        aGivenNotB: notBTotal > 0 ? c.aOnly / notBTotal : null,
        logOr: or ? Math.log(or.value) : null,
      });
    },
    summarize(model, truth) {
      return {
        view: vennView({ ...model.counts }),
        history: model.history.points.slice(),
        truth: truth
          ? { ...truth, aGivenB: truth.joint.both / truth.pB, aGivenNotB: truth.joint.aOnly / (1 - truth.pB) }
          : null,
      };
    },
  },
};
