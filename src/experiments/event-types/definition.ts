import { z } from "zod";
import type { RandomSource } from "@/lib/engine/rng";
import type { ExperimentDefinition } from "../types";

export const OMEGA = [1, 2, 3, 4, 5, 6] as const;

export type EventKind = "yeqin" | "mumkunsuz" | "tesadufi";
export type PairKind = "birge" | "birge-olmayan";
export type QuizAnswer = EventKind | PairKind;

export const ANSWER_LABELS: Record<QuizAnswer, string> = {
  yeqin: "Yəqin",
  mumkunsuz: "Mümkünsüz",
  tesadufi: "Təsadüfi",
  birge: "Birgə",
  "birge-olmayan": "Birgə olmayan",
};

export type QuizItem =
  | { kind: "single"; prompt: string; event: number[]; answer: EventKind; explanation: string }
  | { kind: "pair"; prompt: string; a: { label: string; set: number[] }; b: { label: string; set: number[] }; answer: PairKind; explanation: string };

/** Viktorina - hamısı bir zər atışı üzərində, Ω = {1, ..., 6}. */
export const QUIZ: readonly QuizItem[] = [
  {
    kind: "single",
    prompt: "Zər atılır. Hadisə: 7 xal düşür.",
    event: [],
    answer: "mumkunsuz",
    explanation: "Ω-da 7 yoxdur: hadisə boş çoxluqdur, P = 0.",
  },
  {
    kind: "single",
    prompt: "Zər atılır. Hadisə: 7-dən az xal düşür.",
    event: [1, 2, 3, 4, 5, 6],
    answer: "yeqin",
    explanation: "Bütün nəticələr 7-dən azdır: hadisə Ω-nın özüdür, P = 1.",
  },
  {
    kind: "single",
    prompt: "Zər atılır. Hadisə: 5 xal düşür.",
    event: [5],
    answer: "tesadufi",
    explanation: "Baş verə də bilər, verməyə də: 0 < P = 1/6 < 1.",
  },
  {
    kind: "pair",
    prompt: "A = cüt xal, B = tək xal. Bu hadisələr birgədirmi?",
    a: { label: "cüt", set: [2, 4, 6] },
    b: { label: "tək", set: [1, 3, 5] },
    answer: "birge-olmayan",
    explanation: "A ∩ B = ∅: bir atışda xal həm cüt, həm tək ola bilməz.",
  },
  {
    kind: "pair",
    prompt: "A = cüt xal, B = 3-dən çox xal. Bu hadisələr birgədirmi?",
    a: { label: "cüt", set: [2, 4, 6] },
    b: { label: "3-dən çox", set: [4, 5, 6] },
    answer: "birge",
    explanation: "A ∩ B = {4, 6} ≠ ∅: məsələn, 4 düşsə hər ikisi baş verir.",
  },
];

export const optionsFor = (item: QuizItem): QuizAnswer[] =>
  item.kind === "single" ? ["yeqin", "mumkunsuz", "tesadufi"] : ["birge", "birge-olmayan"];

export function classifyEvent(subset: readonly number[]): EventKind {
  if (subset.length === 0) return "mumkunsuz";
  if (subset.length === OMEGA.length) return "yeqin";
  return "tesadufi";
}

export function classifyPair(a: readonly number[], b: readonly number[]): PairKind {
  return a.some((x) => b.includes(x)) ? "birge" : "birge-olmayan";
}

/** Ölçüsü bərabər ehtimalla seçilən təsadüfi alt çoxluq - boş və tam çoxluq da arabir düşür. */
export function randomSubset(rng: RandomSource): number[] {
  const size = rng.int(OMEGA.length + 1);
  const pool: number[] = [...OMEGA];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size).sort((x, y) => x - y);
}

export interface QuizView {
  /** Hər sual üçün cavab paylanması. */
  distributions: Record<QuizAnswer, number>[];
  step: number;
  revealedUpTo: number;
}

export interface GeneratedExample {
  event: number[];
  eventKind: EventKind;
  a: number[];
  b: number[];
  pairKind: PairKind;
}

export interface EventTypesModel {
  generated: number;
  eventKinds: Record<EventKind, number>;
  pairKinds: Record<PairKind, number>;
  latest: GeneratedExample | null;
}

export type EventTypesSummary = EventTypesModel;

export type EventTypesTypes = {
  input: { item: number; answer: QuizAnswer };
  receipt: { item: number; answer: QuizAnswer };
  aggregate: Record<QuizAnswer, number>[];
  view: QuizView;
  truth: null;
  model: EventTypesModel;
  outcome: GeneratedExample;
  summary: EventTypesSummary;
};

const ALL_ANSWERS = Object.keys(ANSWER_LABELS) as QuizAnswer[];
const emptyDistribution = () => Object.fromEntries(ALL_ANSWERS.map((a) => [a, 0])) as Record<QuizAnswer, number>;

export const eventTypes: ExperimentDefinition<EventTypesTypes> = {
  id: "event-types",
  title: "Hadisənin növünü tap",
  slideRef: "Slayd 7-8: hadisələrin növləri, birgə və birgə olmayan hadisələr",
  phoneInstruction: "Hadisənin növünü seçin.",
  phoneDuringAuto: "participate",
  inputSchema: z
    .object({ item: z.number().int().min(0).max(QUIZ.length - 1), answer: z.enum(ALL_ANSWERS as [QuizAnswer, ...QuizAnswer[]]) })
    .refine(({ item, answer }) => optionsFor(QUIZ[item]).includes(answer), { message: "invalid_option" }),
  perDeviceLimit: 1,
  lists: [],
  steps: QUIZ.length,
  hasReveal: true,

  planSubmission({ item, answer }) {
    return { incr: { [`i${item}:${answer}`]: 1 }, deviceSlot: String(item), revealGuard: item + 1, receipt: { item, answer } };
  },

  decodeAggregate: ({ hash }) =>
    QUIZ.map((_, i) => {
      const d = emptyDistribution();
      for (const a of ALL_ANSWERS) d[a] = hash[`i${i}:${a}`] ?? 0;
      return d;
    }),

  computeView: (distributions, control) => ({ distributions, step: control.step, revealedUpTo: control.reveal }),

  engine: {
    drawHiddenTruth: () => null,
    initModel: () => ({
      generated: 0,
      eventKinds: { yeqin: 0, mumkunsuz: 0, tesadufi: 0 },
      pairKinds: { birge: 0, "birge-olmayan": 0 },
      latest: null,
    }),
    runTrial(_truth, rng) {
      const event = randomSubset(rng);
      // Cüt üçün boş olmayan alt çoxluqlar: birgəlik sualı yalnız real hadisələr üçün maraqlıdır.
      let a = randomSubset(rng);
      while (a.length === 0) a = randomSubset(rng);
      let b = randomSubset(rng);
      while (b.length === 0) b = randomSubset(rng);
      return { event, eventKind: classifyEvent(event), a, b, pairKind: classifyPair(a, b) };
    },
    updateModel(model, example) {
      model.generated += 1;
      model.eventKinds[example.eventKind] += 1;
      model.pairKinds[example.pairKind] += 1;
      model.latest = example;
    },
    summarize: (model) => ({
      ...model,
      eventKinds: { ...model.eventKinds },
      pairKinds: { ...model.pairKinds },
    }),
  },
};
