import { z } from "zod";
import { betaFromCounts, type BetaPosterior } from "@/lib/engine/conjugate";
import { seededRng } from "@/lib/engine/rng";
import { beta, bernoulli, uniform } from "@/lib/engine/samplers";
import { equalSplitChoose, instantRegret, thompsonChoose, type ArmState } from "@/lib/engine/thompson";
import type { ExperimentDefinition } from "../types";
import { createHistory, dualEstimate, recordHistory, type DualEstimate, type History } from "../shared";

export const VARIANTS = [
  { id: "a", label: "Reklam A", headline: "Kurs materialları bir yerdə" },
  { id: "b", label: "Reklam B", headline: "İmtahana 7 gündə hazırlaş" },
  { id: "c", label: "Reklam C", headline: "Statistikanı oyunla öyrən" },
] as const;

export type VariantId = (typeof VARIANTS)[number]["id"];
export const VARIANT_IDS = VARIANTS.map((v) => v.id) as VariantId[];

export interface ArmView {
  shows: number;
  clicks: number;
  estimate: DualEstimate;
  /** P(bu variant ən yaxşıdır) - posteriordan Monte Karlo təxmini. */
  probabilityBest: number;
}

/** Posteriorlardan təkrar nümunə çəkərək hər variantın ən yaxşı olma ehtimalı. */
export function probabilityBest(posteriors: readonly BetaPosterior[], draws = 2000): number[] {
  // Sabit toxum: göstərilən rəqəm səhifə yenilənəndə titrəməsin. Bu, öyrənmə deyil, yalnız təsvirdir.
  const rng = seededRng(posteriors.reduce((s, p) => s * 31 + p.alpha * 7 + p.beta, 17) >>> 0);
  const wins = posteriors.map(() => 0);
  for (let d = 0; d < draws; d += 1) {
    let best = 0;
    let bestValue = -1;
    posteriors.forEach((p, i) => {
      const value = beta(rng, p.alpha, p.beta);
      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    });
    wins[best] += 1;
  }
  return wins.map((w) => w / draws);
}

export function armViews(arms: readonly ArmState[]): ArmView[] {
  const estimates = arms.map((a) => dualEstimate(a.clicks, a.shows));
  const best = probabilityBest(estimates.map((e) => e.posterior));
  return arms.map((a, i) => ({ shows: a.shows, clicks: a.clicks, estimate: estimates[i], probabilityBest: best[i] }));
}

export interface AbView {
  arms: ArmView[];
  visitors: number;
}

export interface AbTruth {
  rates: number[];
}

export interface AbHistoryPoint {
  n: number;
  thompsonRegret: number;
  splitRegret: number;
  shares: number[];
}

export interface AbModel {
  thompson: ArmState[];
  split: ArmState[];
  audience: ArmState[];
  visitors: number;
  thompsonRegret: number;
  splitRegret: number;
  history: History<AbHistoryPoint>;
}

export interface AbSummary {
  thompson: ArmView[];
  split: ArmView[];
  audience: ArmView[];
  visitors: number;
  thompsonRegret: number;
  splitRegret: number;
  history: AbHistoryPoint[];
  truth: AbTruth | null;
}

export type AbOutcome =
  | { kind: "sim"; thompsonArm: number; thompsonClick: boolean; splitArm: number; splitClick: boolean; thompsonRegret: number; splitRegret: number }
  | { kind: "audience"; arm: number; click: boolean };

export type AbTypes = {
  input: { clicked: boolean };
  receipt: { variant: VariantId };
  aggregate: ArmState[];
  view: AbView;
  truth: AbTruth;
  model: AbModel;
  outcome: AbOutcome;
  summary: AbSummary;
};

const emptyArms = (): ArmState[] => VARIANTS.map(() => ({ shows: 0, clicks: 0 }));

/** Auditoriya üçün variant seçimi (server tərəfində, yalnız auditoriya sayğacları ilə). */
export function chooseVariantForVisitor(arms: readonly ArmState[], rng: Parameters<typeof thompsonChoose>[1]): VariantId {
  return VARIANT_IDS[thompsonChoose(arms, rng)];
}

export const abTest: ExperimentDefinition<AbTypes> = {
  id: "ab-test",
  title: "Ağıllı A/B test",
  slideRef: "Slayd 21-25: şərti ehtimal, Bayes, A/B testlər",
  phoneInstruction: "Saytın ziyarətçisi kimi reklama baxın: maraqlıdırsa klik edin.",
  phoneDuringAuto: "participate",
  inputSchema: z.object({ clicked: z.boolean() }),
  perDeviceLimit: 30,
  lists: [],
  hasReveal: false,

  planSubmission({ clicked }) {
    // Variant telefondan gəlmir: Lua skripti serverdə saxlanan təyinatı oxuyub {variant} yerinə qoyur.
    return {
      incr: { "shows:{variant}": 1, "clicks:{variant}": clicked ? 1 : 0 },
      useAssignment: true,
      receipt: { variant: "a" },
    };
  },

  decodeAggregate: ({ hash }) => VARIANT_IDS.map((id) => ({ shows: hash[`shows:${id}`] ?? 0, clicks: hash[`clicks:${id}`] ?? 0 })),

  computeView: (arms) => ({ arms: armViews(arms), visitors: arms.reduce((s, a) => s + a.shows, 0) }),

  engine: {
    drawHiddenTruth: (rng) => ({ rates: VARIANTS.map(() => uniform(rng, 0.02, 0.12)) }),
    initModel: () => ({
      thompson: emptyArms(),
      split: emptyArms(),
      audience: emptyArms(),
      visitors: 0,
      thompsonRegret: 0,
      splitRegret: 0,
      history: createHistory<AbHistoryPoint>(),
    }),
    runTrial(truth, rng, _params, model) {
      const thompsonArm = thompsonChoose(model.thompson, rng);
      const splitArm = equalSplitChoose(model.visitors, VARIANTS.length);
      return {
        kind: "sim",
        thompsonArm,
        thompsonClick: bernoulli(rng, truth.rates[thompsonArm]),
        splitArm,
        splitClick: bernoulli(rng, truth.rates[splitArm]),
        thompsonRegret: instantRegret(truth.rates, thompsonArm),
        splitRegret: instantRegret(truth.rates, splitArm),
      };
    },
    updateModel(model, outcome) {
      if (outcome.kind === "audience") {
        model.audience[outcome.arm].shows += 1;
        if (outcome.click) model.audience[outcome.arm].clicks += 1;
        return;
      }
      model.visitors += 1;
      model.thompson[outcome.thompsonArm].shows += 1;
      if (outcome.thompsonClick) model.thompson[outcome.thompsonArm].clicks += 1;
      model.split[outcome.splitArm].shows += 1;
      if (outcome.splitClick) model.split[outcome.splitArm].clicks += 1;
      model.thompsonRegret += outcome.thompsonRegret;
      model.splitRegret += outcome.splitRegret;
      recordHistory(model.history, {
        n: model.visitors,
        thompsonRegret: model.thompsonRegret,
        splitRegret: model.splitRegret,
        shares: model.thompson.map((a) => a.shows / model.visitors),
      });
    },
    summarize(model, truth) {
      return {
        thompson: armViews(model.thompson),
        split: armViews(model.split),
        audience: armViews(model.audience),
        visitors: model.visitors,
        thompsonRegret: model.thompsonRegret,
        splitRegret: model.splitRegret,
        history: model.history.points.slice(),
        truth,
      };
    },
  },
};

export function posteriorOf(arm: ArmState): BetaPosterior {
  return betaFromCounts(arm.clicks, arm.shows - arm.clicks);
}
