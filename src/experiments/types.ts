import type { z } from "zod";
import type { RandomSource } from "@/lib/engine/rng";

export const EXPERIMENT_IDS = [
  "dice",
  "event-types",
  "seasons",
  "venn",
  "birthday",
  "monte-carlo",
  "bayes-test",
  "random-seq",
  "ab-test",
] as const;

export type ExperimentId = (typeof EXPERIMENT_IDS)[number];
export type RunMode = "audience" | "auto" | "both";
export type ExpStatus = "open" | "closed";

export const RUN_MODE_LABELS: Record<RunMode, string> = {
  audience: "Auditoriya",
  auto: "Avtonom",
  both: "Hər ikisi",
};

/** Aqreqatın xam forması: Redis hash sayğacları və məhdud siyahılar. */
export interface AggregateSource {
  hash: Record<string, number>;
  lists: Record<string, string[]>;
}

export interface ListPush {
  list: string;
  items: string[];
  cap: number;
}

/**
 * Bir göndərişin saxlama planı. Təsadüfilik (zər, nöqtələr) planlaşdırma zamanı serverdə yaranır.
 * `{variant}` yer tutucusu A/B testində serverdə saxlanan təyinatla əvəz olunur.
 */
export interface SubmissionPlan<R> {
  incr: Record<string, number>;
  push?: ListPush[];
  /** Cihaz limiti açarının əlavəsi (məs. sual nömrəsi): limit hər açar üçün ayrıca sayılır. */
  deviceSlot?: string;
  /** Bu qiymətdən böyük və ya bərabər "reveal" olduqda göndəriş rədd edilir (0 = yoxlama yoxdur). */
  revealGuard?: number;
  useAssignment?: boolean;
  receipt: R;
}

/** Proyektor və telefon üçün idarəetmə vəziyyəti (bir eksperiment üzrə). */
export interface ExperimentControl {
  status: ExpStatus;
  mode: RunMode;
  /** 0 = gizli; sual-cavab eksperimentlərində açılmış sualların sayı. */
  reveal: number;
  /** Cari addım (məs. viktorinada sual nömrəsi). */
  step: number;
  /** Hər sıfırlamada artır - telefonlar köhnə qəbzləri unudur. */
  epoch: number;
}

export interface EngineParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
}

/** Bütün tip parametrləri bir yerdə - hər modulda oxunaqlı qalsın deyə. */
export interface ExperimentTypes {
  input: unknown;
  receipt: unknown;
  aggregate: unknown;
  view: unknown;
  truth?: unknown;
  model?: unknown;
  outcome?: unknown;
  summary?: unknown;
}

export type EngineParams = Record<string, number>;

export interface EngineHooks<T extends ExperimentTypes> {
  params?: readonly EngineParamSpec[];
  drawHiddenTruth(rng: RandomSource, params: EngineParams): T["truth"];
  initModel(params: EngineParams): T["model"];
  runTrial(truth: T["truth"], rng: RandomSource, params: EngineParams, model: T["model"]): T["outcome"];
  /** Modeli yerində yeniləyir (yüksək sürətdə yaddaş ayrılmasın deyə). */
  updateModel(model: T["model"], outcome: T["outcome"], source: "sim" | "audience"): void;
  /** truth yalnız "Gizli parametri göstər"dən sonra ötürülür. */
  summarize(model: T["model"], truth: T["truth"] | null, params: EngineParams): T["summary"];
  /** Parametr dəyişdikdə (məs. ad günü qrupunun ölçüsü) modeli sıfırlamaq lazımdırmı? */
  resetOnParamChange?: boolean;
}

export interface ExperimentDefinition<T extends ExperimentTypes> {
  id: ExperimentId;
  title: string;
  slideRef: string;
  /** Telefonda bir cümləlik təlimat. */
  phoneInstruction: string;
  /** Avtonom rejimdə telefon: "watch" = ekrana baxın; "participate" = istəyə görə iştirak. */
  phoneDuringAuto: "watch" | "participate";
  inputSchema: z.ZodType<T["input"]>;
  perDeviceLimit: number;
  /** Proyektorun oxuduğu siyahılar və oxunan maksimal uzunluq. */
  lists: readonly { name: string; read: number }[];
  /** Sual-cavab tipli eksperimentlərdə addımların sayı (yoxdursa 1). */
  steps?: number;
  /** "Cavabı göstər" mövcuddurmu (2, 5, 7). */
  hasReveal: boolean;
  planSubmission(input: T["input"], rng: RandomSource): SubmissionPlan<T["receipt"]>;
  decodeAggregate(source: AggregateSource): T["aggregate"];
  computeView(aggregate: T["aggregate"], control: ExperimentControl): T["view"];
  engine?: EngineHooks<T>;
}

/**
 * Reyestrdə saxlamaq üçün ümumiləşdirilmiş forma. Metodlar qısa sintaksislə elan olunduğundan
 * TypeScript onları bivariant yoxlayır - konkret tərif bu tipə mənimsədilə bilir.
 */
export type AnyExperiment = ExperimentDefinition<ExperimentTypes>;
