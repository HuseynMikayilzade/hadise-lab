import { AbProjector } from "./ab-test/Projector";
import { VARIANT_IDS, type AbView } from "./ab-test/definition";
import { BayesProjector } from "./bayes-test/Projector";
import { BirthdayProjector } from "./birthday/Projector";
import { DiceProjector } from "./dice/Projector";
import { EventTypesProjector } from "./event-types/Projector";
import { MonteCarloProjector } from "./monte-carlo/Projector";
import { RandomSeqProjector } from "./random-seq/Projector";
import type { SequenceView } from "./random-seq/definition";
import { SeasonsProjector } from "./seasons/Projector";
import type { ExperimentId } from "./types";
import { asProjector, type AudienceForwarder, type ProjectorComponent } from "./ui-types";
import { VennProjector } from "./venn/Projector";

export interface ProjectorEntry {
  Projector: ProjectorComponent;
  /** "Gizli parametri göstər" mənalıdırmı? */
  hasHiddenTruth: boolean;
  /** Auditoriya məlumatını mühərrikə ayrıca seriya kimi ötürmək üçün. */
  forwardAudience?: AudienceForwarder;
}

/** A/B: sayğacların artımı → hər yeni göstəriş üçün bir müşahidə. */
const forwardAbClicks: AudienceForwarder = (previous, next) => {
  const prev = previous as AbView | null;
  const curr = next as AbView;
  const outcomes: { kind: "audience"; arm: number; click: boolean }[] = [];
  VARIANT_IDS.forEach((_, arm) => {
    const shows = curr.arms[arm].shows - (prev?.arms[arm].shows ?? 0);
    const clicks = curr.arms[arm].clicks - (prev?.arms[arm].clicks ?? 0);
    for (let i = 0; i < Math.max(0, shows); i += 1) outcomes.push({ kind: "audience", arm, click: i < clicks });
  });
  return outcomes;
};

/** Ardıcıllıqlar: siyahı ən yenidən başlayır; yeni gələnlər n-in artımı qədərdir. */
const forwardSequences: AudienceForwarder = (previous, next) => {
  const prev = previous as SequenceView | null;
  const curr = next as SequenceView;
  const added = Math.max(0, curr.n - (prev?.n ?? 0));
  return curr.sequences.slice(0, added).map((sequence) => ({ source: "audience", sequence }));
};

/**
 * Proyektor reyestri: bütün komponentlər statik idxal olunur ki, ilk yükləmədən sonra
 * hər eksperiment (və worker) internet olmadan da açılsın.
 */
export const PROJECTORS: Readonly<Record<ExperimentId, ProjectorEntry>> = {
  dice: { Projector: asProjector(DiceProjector), hasHiddenTruth: true },
  "event-types": { Projector: asProjector(EventTypesProjector), hasHiddenTruth: false },
  seasons: { Projector: asProjector(SeasonsProjector), hasHiddenTruth: true },
  venn: { Projector: asProjector(VennProjector), hasHiddenTruth: true },
  birthday: { Projector: asProjector(BirthdayProjector), hasHiddenTruth: false },
  "monte-carlo": { Projector: asProjector(MonteCarloProjector), hasHiddenTruth: false },
  "bayes-test": { Projector: asProjector(BayesProjector), hasHiddenTruth: true },
  "random-seq": { Projector: asProjector(RandomSeqProjector), hasHiddenTruth: false, forwardAudience: forwardSequences },
  "ab-test": { Projector: asProjector(AbProjector), hasHiddenTruth: true, forwardAudience: forwardAbClicks },
};
