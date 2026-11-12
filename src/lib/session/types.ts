import type { ExperimentControl, ExperimentId, ExpStatus, RunMode, SubmissionPlan } from "@/experiments/types";
import { EXPERIMENT_IDS } from "@/experiments/types";

export interface SessionState {
  /** Hər idarəetmə dəyişikliyində artır - telefonlar və ekran yalnız dəyişəndə yenilənir. */
  version: number;
  active: ExperimentId | null;
  controls: Record<ExperimentId, ExperimentControl>;
  participants: number;
  /** Tam sıfırlamada dəyişir. */
  generation: number;
}

export interface AggregateSnapshot {
  /** Vəziyyət və məlumat versiyalarının birləşməsi - sıfırlamadan sonra da toqquşmur. */
  version: string;
  hash: Record<string, number>;
  lists: Record<string, string[]>;
}

export type SubmitOutcome =
  | { kind: "accepted"; variant: string }
  | { kind: "inactive" }
  | { kind: "closed" }
  | { kind: "revealed" }
  | { kind: "limit" }
  | { kind: "no_assignment" };

export type ControlPatch = Partial<Pick<ExperimentControl, "status" | "mode" | "reveal" | "step">>;

export interface StatePatch {
  active?: ExperimentId | null;
  experiment?: ExperimentId;
  control?: ControlPatch;
}

export interface SubmitRequest {
  experiment: ExperimentId;
  deviceId: string;
  limit: number;
  lists: readonly string[];
  plan: SubmissionPlan<unknown>;
}

/**
 * Saxlama qatının müqaviləsi. Tətbiq yalnız bu interfeysdən asılıdır - Redis və ya yaddaş.
 * Bütün yazma əməliyyatları atomikdir.
 */
export interface LabStore {
  getState(code: string): Promise<SessionState>;
  updateState(code: string, patch: StatePatch): Promise<SessionState>;
  join(code: string, deviceId: string): Promise<void>;
  getAggregate(code: string, experiment: ExperimentId, lists: readonly { name: string; read: number }[]): Promise<AggregateSnapshot>;
  submit(code: string, request: SubmitRequest): Promise<SubmitOutcome>;
  /** A/B testi: server tərəfindən seçilmiş variantı qısa müddətə yadda saxlayır. */
  setAssignment(code: string, experiment: ExperimentId, deviceId: string, variant: string, ttlMs: number): Promise<void>;
  resetExperiment(code: string, experiment: ExperimentId, lists: readonly string[]): Promise<void>;
  resetAll(code: string, lists: Readonly<Record<ExperimentId, readonly string[]>>): Promise<void>;
}

export const DEFAULT_CONTROL: ExperimentControl = Object.freeze({ status: "open", mode: "audience", reveal: 0, step: 0, epoch: 0 });

const STATUSES: readonly ExpStatus[] = ["open", "closed"];
const MODES: readonly RunMode[] = ["audience", "auto", "both"];

const toInt = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
};

export function toCounter(value: unknown): number {
  return toInt(value);
}

/** Redis hash-dan (bütün dəyərlər sətir) tipli vəziyyətə çevirmə; naməlum dəyərlər susmaya düşür. */
export function decodeState(hash: Record<string, unknown> | null, participants: number): SessionState {
  const h = hash ?? {};
  const activeRaw = typeof h.active === "string" ? h.active : null;
  const active = (EXPERIMENT_IDS as readonly string[]).includes(activeRaw ?? "") ? (activeRaw as ExperimentId) : null;
  const controls = {} as Record<ExperimentId, ExperimentControl>;
  for (const id of EXPERIMENT_IDS) {
    const status = String(h[`status:${id}`] ?? "");
    const mode = String(h[`mode:${id}`] ?? "");
    controls[id] = {
      status: (STATUSES as readonly string[]).includes(status) ? (status as ExpStatus) : DEFAULT_CONTROL.status,
      mode: (MODES as readonly string[]).includes(mode) ? (mode as RunMode) : DEFAULT_CONTROL.mode,
      reveal: toInt(h[`reveal:${id}`]),
      step: toInt(h[`step:${id}`]),
      epoch: toInt(h[`epoch:${id}`]),
    };
  }
  return { version: toInt(h.ver), active, controls, participants, generation: toInt(h.gen) };
}

/** StatePatch-ı hash sahələrinə çevirir. */
export function patchToFields(patch: StatePatch): Record<string, string> {
  const fields: Record<string, string> = {};
  if (patch.active !== undefined) fields.active = patch.active ?? "";
  if (patch.experiment && patch.control) {
    for (const [key, value] of Object.entries(patch.control)) {
      if (value !== undefined) fields[`${key}:${patch.experiment}`] = String(value);
    }
  }
  return fields;
}
