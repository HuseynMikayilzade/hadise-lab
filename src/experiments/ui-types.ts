import type { ComponentType } from "react";
import type { EngineSnapshot } from "@/engine-worker/protocol";
import type { ExperimentControl, ExperimentId, RunMode } from "./types";

export interface ProjectorProps<View, Summary> {
  /** Auditoriya məlumatı (serverdən). Avtonom rejimdə null. */
  audience: View | null;
  /** Simulyasiya xülasəsi (Web Worker-dən). Auditoriya rejimində null. */
  sim: Summary | null;
  snapshot: EngineSnapshot<Summary> | null;
  mode: RunMode;
  control: ExperimentControl;
  /** ≥100 sınaq/s: hər sınaq üçün animasiya söndürülür. */
  fast: boolean;
  /** Təqdimatçı idarəsi göstərilirmi (?admin və ya ?demo). */
  presenter: boolean;
  setParam: (key: string, value: number) => void;
}

export interface PhoneProps<Draft> {
  code: string;
  exp: ExperimentId;
  deviceId: string;
  control: ExperimentControl;
  /** Qəbzlərin saxlanma açarı - sıfırlamadan sonra dəyişir. */
  scope: string;
  draft: Draft | undefined;
  setDraft: (draft: Draft | undefined) => void;
}

/** Heterogen reyestr üçün tip silinmiş formalar (yeganə tip çevrilməsi burada edilir). */
export type ProjectorComponent = ComponentType<ProjectorProps<unknown, unknown>>;
export type PhoneComponent = ComponentType<PhoneProps<unknown>>;

export function asProjector<V, S>(component: ComponentType<ProjectorProps<V, S>>): ProjectorComponent {
  return component as unknown as ProjectorComponent;
}

export function asPhone<D>(component: ComponentType<PhoneProps<D>>): PhoneComponent {
  return component as unknown as PhoneComponent;
}

/** "Hər ikisi" rejimində yeni auditoriya müşahidələrini mühərrikə ötürmək üçün. */
export type AudienceForwarder = (previous: unknown | null, next: unknown) => unknown[];
