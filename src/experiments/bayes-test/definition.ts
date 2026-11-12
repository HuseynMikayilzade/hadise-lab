import { z } from "zod";
import { bernoulli, uniform } from "@/lib/engine/samplers";
import {
  DEFAULT_SCENARIO,
  naturalFrequencies,
  posteriorGivenPositive,
  updateAfterTest,
  type NaturalFrequencies,
  type TestScenario,
} from "@/lib/stats/bayes";
import type { ExperimentDefinition } from "../types";
import { createHistory, dualEstimate, recordConvergence, sum, type ConvergencePoint, type DualEstimate, type History } from "../shared";

export const GUESS_BUCKET = 5;
export const GUESS_BUCKETS = 100 / GUESS_BUCKET;

export interface BayesView {
  buckets: number[];
  n: number;
  meanGuess: number | null;
  scenario: TestScenario;
  answer: number;
  frequencies: NaturalFrequencies;
  revealed: boolean;
}

export interface SequentialTest {
  positive: boolean;
  posterior: number;
}

export interface SequentialPatient {
  ill: boolean;
  prior: number;
  tests: SequentialTest[];
}

export interface BayesModel {
  population: number;
  ill: number;
  positive: number;
  illPositive: number;
  history: History<ConvergencePoint>;
  patient: SequentialPatient | null;
  sinceLastTest: number;
}

export interface BayesSummary {
  population: number;
  ill: number;
  positive: number;
  illPositive: number;
  estimate: DualEstimate;
  history: ConvergencePoint[];
  patient: SequentialPatient | null;
  /** Ssenarinin rəsmi dəyərləri ilə Bayes cavabı - gizli parametrlərdən asılı deyil. */
  scenarioAnswer: number;
  truth: (TestScenario & { answer: number }) | null;
}

export type BayesTypes = {
  input: { guess: number };
  receipt: { guess: number };
  aggregate: { buckets: number[]; total: number };
  view: BayesView;
  truth: TestScenario;
  model: BayesModel;
  outcome: { ill: boolean; positive: boolean; patientTest: boolean | null };
  summary: BayesSummary;
};

const PATIENT_TEST_EVERY = 40;
const PATIENT_MAX_TESTS = 6;

export const bayesTest: ExperimentDefinition<BayesTypes> = {
  id: "bayes-test",
  title: "Test müsbətdir - xəstəsən?",
  slideRef: "Slayd 22-24: tam ehtimal düsturu və Bayes düsturu",
  phoneInstruction: "Ssenarini oxuyun və ehtimalı təxmin edin.",
  phoneDuringAuto: "watch",
  inputSchema: z.object({ guess: z.number().int().min(0).max(100) }),
  perDeviceLimit: 1,
  lists: [],
  hasReveal: true,

  planSubmission({ guess }) {
    const bucket = Math.min(GUESS_BUCKETS - 1, Math.floor(guess / GUESS_BUCKET));
    return { incr: { [`g${bucket}`]: 1, total: guess }, revealGuard: 1, receipt: { guess } };
  },

  decodeAggregate: ({ hash }) => ({
    buckets: Array.from({ length: GUESS_BUCKETS }, (_, i) => hash[`g${i}`] ?? 0),
    total: hash.total ?? 0,
  }),

  computeView({ buckets, total }, control) {
    const n = sum(buckets);
    return {
      buckets,
      n,
      meanGuess: n > 0 ? total / n / 100 : null,
      scenario: DEFAULT_SCENARIO,
      answer: posteriorGivenPositive(DEFAULT_SCENARIO),
      frequencies: naturalFrequencies(DEFAULT_SCENARIO),
      revealed: control.reveal > 0,
    };
  },

  engine: {
    drawHiddenTruth: (rng) => ({
      prevalence: uniform(rng, 0.005, 0.02),
      sensitivity: uniform(rng, 0.85, 0.95),
      falsePositiveRate: uniform(rng, 0.06, 0.12),
    }),
    initModel: () => ({
      population: 0,
      ill: 0,
      positive: 0,
      illPositive: 0,
      history: createHistory<ConvergencePoint>(),
      patient: null,
      sinceLastTest: 0,
    }),
    runTrial(truth, rng, _params, model) {
      const ill = bernoulli(rng, truth.prevalence);
      const positive = bernoulli(rng, ill ? truth.sensitivity : truth.falsePositiveRate);
      // Ardıcıl testləmə: eyni pasiyent bir neçə dəfə yoxlanılır.
      let patientTest: boolean | null = null;
      const patient = model.patient;
      if (patient && patient.tests.length < PATIENT_MAX_TESTS && model.sinceLastTest + 1 >= PATIENT_TEST_EVERY) {
        patientTest = bernoulli(rng, patient.ill ? truth.sensitivity : truth.falsePositiveRate);
      }
      return { ill, positive, patientTest };
    },
    updateModel(model, { ill, positive, patientTest }) {
      model.population += 1;
      if (ill) model.ill += 1;
      if (positive) {
        model.positive += 1;
        if (ill) model.illPositive += 1;
        recordConvergence(model.history, model.illPositive, model.positive);
      }
      model.sinceLastTest += 1;
      // Pasiyent: ilk müsbət nəticə alan simulyasiya iştirakçısı. Onun prioru ssenarinin yayılmasıdır.
      if (!model.patient && positive) {
        const prior = DEFAULT_SCENARIO.prevalence;
        model.patient = { ill, prior, tests: [{ positive: true, posterior: updateAfterTest(prior, true, DEFAULT_SCENARIO) }] };
        model.sinceLastTest = 0;
      } else if (model.patient && patientTest !== null) {
        const last = model.patient.tests[model.patient.tests.length - 1];
        model.patient.tests.push({ positive: patientTest, posterior: updateAfterTest(last.posterior, patientTest, DEFAULT_SCENARIO) });
        model.sinceLastTest = 0;
      }
    },
    summarize(model, truth) {
      return {
        population: model.population,
        ill: model.ill,
        positive: model.positive,
        illPositive: model.illPositive,
        estimate: dualEstimate(model.illPositive, model.positive),
        history: model.history.points.slice(),
        patient: model.patient ? { ...model.patient, tests: model.patient.tests.slice() } : null,
        scenarioAnswer: posteriorGivenPositive(DEFAULT_SCENARIO),
        truth: truth ? { ...truth, answer: posteriorGivenPositive(truth) } : null,
      };
    },
  },
};
