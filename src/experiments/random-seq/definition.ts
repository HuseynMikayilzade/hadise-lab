import { z } from "zod";
import { accuracy, createLogistic, predictProbability, trainStep, type LogisticModel } from "@/lib/engine/logistic";
import { longestRun, randomSequence, sequenceFeatures, SEQUENCE_LENGTH, SEQUENCE_PATTERN, switchCount } from "@/lib/stats/runs";
import type { ExperimentDefinition } from "../types";
import { sum } from "../shared";

export const MAX_RUN_BUCKET = 10;

/**
 * Ədalətli sikkə üçün dəqiq paylanma: n atışda ən uzun seriyanın uzunluğu.
 * Dinamik proqramlaşdırma: dp[r] = sonu r uzunluqlu seriya ilə bitən və max ≤ k olan ardıcıllıqların sayı.
 */
export function longestRunDistribution(n = SEQUENCE_LENGTH): number[] {
  const atMost = (k: number): number => {
    let dp = new Array<number>(k + 1).fill(0);
    dp[1] = 2;
    for (let i = 2; i <= n; i += 1) {
      const next = new Array<number>(k + 1).fill(0);
      const total = sum(dp);
      next[1] = total;
      for (let r = 1; r < k; r += 1) next[r + 1] = dp[r];
      dp = next;
    }
    return sum(dp) / 2 ** n;
  };
  const result = new Array<number>(MAX_RUN_BUCKET + 1).fill(0);
  let previous = 0;
  for (let k = 1; k <= n; k += 1) {
    const cumulative = atMost(k);
    result[Math.min(k, MAX_RUN_BUCKET)] += cumulative - previous;
    previous = cumulative;
  }
  return result;
}

/** Dəyişmə sayı ~ Binomial(n - 1, 1/2). */
export function switchDistribution(n = SEQUENCE_LENGTH): number[] {
  const m = n - 1;
  const result: number[] = [];
  let coefficient = 1;
  for (let k = 0; k <= m; k += 1) {
    result.push(coefficient / 2 ** m);
    coefficient = (coefficient * (m - k)) / (k + 1);
  }
  return result;
}

export interface SequenceView {
  n: number;
  runHistogram: number[];
  switchHistogram: number[];
  expectedRuns: number[];
  expectedSwitches: number[];
  sequences: string[];
}

export interface SequenceModel {
  n: number;
  runHistogram: number[];
  switchHistogram: number[];
  latest: string | null;
  audience: string[];
  classifier: LogisticModel;
  audienceCursor: number;
}

export interface SequenceSummary {
  n: number;
  runHistogram: number[];
  switchHistogram: number[];
  expectedRuns: number[];
  expectedSwitches: number[];
  latest: string | null;
  audienceCount: number;
  accuracy: number | null;
  trained: number;
  /** Ən son auditoriya ardıcıllığı üçün "insan" ehtimalı. */
  latestHumanProbability: number | null;
}

export type SequenceTypes = {
  input: { sequence: string };
  receipt: { longestRun: number; switches: number };
  aggregate: { runs: number[]; switches: number[]; sequences: string[] };
  view: SequenceView;
  truth: null;
  model: SequenceModel;
  outcome: { source: "sim"; sequence: string } | { source: "audience"; sequence: string };
  summary: SequenceSummary;
};

const EXPECTED_RUNS = longestRunDistribution();
const EXPECTED_SWITCHES = switchDistribution();

export const randomSeq: ExperimentDefinition<SequenceTypes> = {
  id: "random-seq",
  title: "Təsadüfi ardıcıllıq yaz",
  slideRef: "Slayd 13-14, 25: statistik tərif, tətbiq",
  phoneInstruction: "Sikkəni 20 dəfə \"atdığınızı\" təsəvvür edin: G (gerb) və ya R (rəqəm) yazın.",
  phoneDuringAuto: "participate",
  inputSchema: z.object({ sequence: z.string().regex(SEQUENCE_PATTERN) }),
  perDeviceLimit: 1,
  lists: [{ name: "seqs", read: 300 }],
  hasReveal: false,

  planSubmission({ sequence }) {
    const run = longestRun(sequence);
    const switches = switchCount(sequence);
    return {
      incr: { [`lr${Math.min(run, MAX_RUN_BUCKET)}`]: 1, [`sw${switches}`]: 1 },
      push: [{ list: "seqs", items: [sequence], cap: 300 }],
      receipt: { longestRun: run, switches },
    };
  },

  decodeAggregate: ({ hash, lists }) => ({
    runs: Array.from({ length: MAX_RUN_BUCKET + 1 }, (_, i) => hash[`lr${i}`] ?? 0),
    switches: Array.from({ length: SEQUENCE_LENGTH }, (_, i) => hash[`sw${i}`] ?? 0),
    sequences: (lists.seqs ?? []).filter((s) => SEQUENCE_PATTERN.test(s)),
  }),

  computeView: ({ runs, switches, sequences }) => ({
    n: sum(runs),
    runHistogram: runs,
    switchHistogram: switches,
    expectedRuns: EXPECTED_RUNS,
    expectedSwitches: EXPECTED_SWITCHES,
    sequences,
  }),

  engine: {
    drawHiddenTruth: () => null,
    initModel: () => ({
      n: 0,
      runHistogram: new Array<number>(MAX_RUN_BUCKET + 1).fill(0),
      switchHistogram: new Array<number>(SEQUENCE_LENGTH).fill(0),
      latest: null,
      audience: [],
      classifier: createLogistic(3, 0.05),
      audienceCursor: 0,
    }),
    runTrial: (_truth, rng) => ({ source: "sim", sequence: randomSequence(rng) }),
    updateModel(model, outcome) {
      if (outcome.source === "audience") {
        model.audience.push(outcome.sequence);
        return;
      }
      model.n += 1;
      model.runHistogram[Math.min(longestRun(outcome.sequence), MAX_RUN_BUCKET)] += 1;
      model.switchHistogram[switchCount(outcome.sequence)] += 1;
      model.latest = outcome.sequence;
      // Klassifikator yalnız auditoriya ardıcıllıqları olduqda öyrənir: bir təsadüfi, bir insan nümunəsi növbə ilə.
      if (model.audience.length > 0) {
        trainStep(model.classifier, sequenceFeatures(outcome.sequence), 0);
        const human = model.audience[model.audienceCursor % model.audience.length];
        model.audienceCursor += 1;
        trainStep(model.classifier, sequenceFeatures(human), 1);
      }
    },
    summarize(model) {
      const lastHuman = model.audience[model.audience.length - 1];
      return {
        n: model.n,
        runHistogram: model.runHistogram.slice(),
        switchHistogram: model.switchHistogram.slice(),
        expectedRuns: EXPECTED_RUNS,
        expectedSwitches: EXPECTED_SWITCHES,
        latest: model.latest,
        audienceCount: model.audience.length,
        accuracy: accuracy(model.classifier),
        trained: model.classifier.seen,
        latestHumanProbability: lastHuman ? predictProbability(model.classifier, sequenceFeatures(lastHuman)) : null,
      };
    },
  },
};
