import { z } from "zod";
import { birthdayMatchProbability, DAYS_IN_YEAR, simulateGroupHasMatch } from "@/lib/stats/birthday";
import type { ExperimentDefinition } from "../types";
import { createHistory, dualEstimate, recordConvergence, sum, type ConvergencePoint, type DualEstimate, type History } from "../shared";

export const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
] as const;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const GUESS_OPTIONS = [
  { id: "0-10", label: "10%-dən az" },
  { id: "10-30", label: "10-30%" },
  { id: "30-50", label: "30-50%" },
  { id: "50-70", label: "50-70%" },
  { id: "70-90", label: "70-90%" },
  { id: "90-100", label: "90%-dən çox" },
] as const;

export type GuessId = (typeof GUESS_OPTIONS)[number]["id"];
const GUESS_IDS = GUESS_OPTIONS.map((g) => g.id) as [GuessId, ...GuessId[]];

export function isValidDate(day: number, month: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

export const dateKey = (day: number, month: number) => `d${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function formatDate(key: string): string {
  const match = /^d(\d{2})-(\d{2})$/.exec(key);
  if (!match) return key;
  return `${Number(match[2])} ${MONTHS[Number(match[1]) - 1]}`;
}

export function guessBucketFor(probability: number): GuessId {
  const pct = probability * 100;
  if (pct < 10) return "0-10";
  if (pct < 30) return "10-30";
  if (pct < 50) return "30-50";
  if (pct < 70) return "50-70";
  if (pct < 90) return "70-90";
  return "90-100";
}

export interface BirthdayView {
  n: number;
  /** Yalnız təkrarlanan tarixlər (heç bir şəxsiyyət yoxdur). */
  matches: { date: string; count: number }[];
  exact: number;
  guesses: Record<GuessId, number>;
  guessTotal: number;
  revealed: boolean;
}

export interface BirthdayModel {
  n: number;
  groups: number;
  hits: number;
  history: History<ConvergencePoint>;
}

export interface BirthdaySummary {
  n: number;
  groups: number;
  hits: number;
  estimate: DualEstimate;
  exact: number;
  history: ConvergencePoint[];
}

export type BirthdayTypes = {
  input: { day: number; month: number; guess: GuessId };
  receipt: { date: string };
  aggregate: { dates: Record<string, number>; guesses: Record<GuessId, number> };
  view: BirthdayView;
  truth: null;
  model: BirthdayModel;
  outcome: boolean;
  summary: BirthdaySummary;
};

export const birthday: ExperimentDefinition<BirthdayTypes> = {
  id: "birthday",
  title: "Doğum günü paradoksu",
  slideRef: "Slayd 11-12: əks hadisə, P(Ā) = 1 - P(A)",
  phoneInstruction: "Yalnız gün və ayı daxil edin - il və ad lazım deyil.",
  phoneDuringAuto: "watch",
  inputSchema: z
    .object({ day: z.number().int().min(1).max(31), month: z.number().int().min(1).max(12), guess: z.enum(GUESS_IDS) })
    .refine(({ day, month }) => isValidDate(day, month), { message: "invalid_date" }),
  perDeviceLimit: 1,
  lists: [],
  hasReveal: true,

  planSubmission({ day, month, guess }) {
    const key = dateKey(day, month);
    return { incr: { [key]: 1, [`g:${guess}`]: 1 }, receipt: { date: formatDate(key) } };
  },

  decodeAggregate({ hash }) {
    const dates: Record<string, number> = {};
    for (const [field, value] of Object.entries(hash)) if (field.startsWith("d")) dates[field] = value;
    const guesses = Object.fromEntries(GUESS_IDS.map((g) => [g, hash[`g:${g}`] ?? 0])) as Record<GuessId, number>;
    return { dates, guesses };
  },

  computeView({ dates, guesses }, control) {
    const n = sum(Object.values(dates));
    return {
      n,
      matches: Object.entries(dates)
        .filter(([, count]) => count >= 2)
        .map(([date, count]) => ({ date: formatDate(date), count }))
        .sort((a, b) => b.count - a.count),
      exact: birthdayMatchProbability(n),
      guesses,
      guessTotal: sum(Object.values(guesses)),
      revealed: control.reveal > 0,
    };
  },

  engine: {
    params: [{ key: "n", label: "Qrupun ölçüsü n", min: 2, max: 80, step: 1, initial: 23 }],
    resetOnParamChange: true,
    drawHiddenTruth: () => null,
    initModel: (params) => ({ n: params.n ?? 23, groups: 0, hits: 0, history: createHistory<ConvergencePoint>() }),
    runTrial: (_truth, rng, _params, model) => simulateGroupHasMatch(model.n, rng, DAYS_IN_YEAR),
    updateModel(model, hit) {
      model.groups += 1;
      if (hit) model.hits += 1;
      recordConvergence(model.history, model.hits, model.groups);
    },
    summarize: (model) => ({
      n: model.n,
      groups: model.groups,
      hits: model.hits,
      estimate: dualEstimate(model.hits, model.groups),
      exact: birthdayMatchProbability(model.n),
      history: model.history.points.slice(),
    }),
  },
};
