import { abTest } from "./ab-test/definition";
import { bayesTest } from "./bayes-test/definition";
import { birthday } from "./birthday/definition";
import { dice } from "./dice/definition";
import { eventTypes } from "./event-types/definition";
import { monteCarlo } from "./monte-carlo/definition";
import { randomSeq } from "./random-seq/definition";
import { seasons } from "./seasons/definition";
import { venn } from "./venn/definition";
import { EXPERIMENT_IDS, type AnyExperiment, type ExperimentId } from "./types";

/**
 * Server tərəfində təhlükəsiz reyestr: yalnız saf təriflər (React yoxdur).
 * API, Web Worker və testlər buradan oxuyur. Sıra = təqdimatdakı bölmələrin sırası.
 */
export const EXPERIMENTS: Readonly<Record<ExperimentId, AnyExperiment>> = {
  dice,
  "event-types": eventTypes,
  seasons,
  venn,
  birthday,
  "monte-carlo": monteCarlo,
  "bayes-test": bayesTest,
  "random-seq": randomSeq,
  "ab-test": abTest,
};

export function getExperiment(id: string): AnyExperiment | null {
  return (EXPERIMENT_IDS as readonly string[]).includes(id) ? EXPERIMENTS[id as ExperimentId] : null;
}

export const LIST_NAMES = Object.fromEntries(
  EXPERIMENT_IDS.map((id) => [id, EXPERIMENTS[id].lists.map((l) => l.name)]),
) as Record<ExperimentId, string[]>;
