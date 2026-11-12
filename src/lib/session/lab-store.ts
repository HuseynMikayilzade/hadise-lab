import type { ExperimentId } from "@/experiments/types";
import { EXPERIMENT_IDS } from "@/experiments/types";
import { experimentKeys, sessionKeys, TTL_SECONDS } from "./keys";
import type { RedisLike } from "./redis-like";
import { JOIN, RESET_ALL, RESET_EXPERIMENT, SET_ASSIGNMENT, SUBMIT, UPDATE_STATE } from "./scripts";
import {
  decodeState,
  patchToFields,
  toCounter,
  type AggregateSnapshot,
  type LabStore,
  type SessionState,
  type StatePatch,
  type SubmitOutcome,
  type SubmitRequest,
} from "./types";

const TTL = String(TTL_SECONDS);
const OUTCOMES = new Set(["accepted", "inactive", "closed", "revealed", "limit", "no_assignment"]);

/** Tək store implementasiyası: real Redis (Upstash) və ya yaddaşdakı əkiz üzərində işləyir. */
export class RedisLabStore implements LabStore {
  constructor(private readonly redis: RedisLike) {}

  async getState(code: string): Promise<SessionState> {
    const k = sessionKeys(code);
    const [hash, participants] = await Promise.all([this.redis.hgetall(k.state), this.redis.pfcount(k.people)]);
    return decodeState(hash, toCounter(participants));
  }

  async updateState(code: string, patch: StatePatch): Promise<SessionState> {
    const fields = patchToFields(patch);
    const args = [TTL];
    for (const [field, value] of Object.entries(fields)) args.push(field, value);
    await this.redis.eval(UPDATE_STATE.lua, [sessionKeys(code).state], args);
    return this.getState(code);
  }

  async join(code: string, deviceId: string): Promise<void> {
    await this.redis.eval(JOIN.lua, [sessionKeys(code).people], [deviceId, TTL]);
  }

  async getAggregate(
    code: string,
    experiment: ExperimentId,
    lists: readonly { name: string; read: number }[],
  ): Promise<AggregateSnapshot> {
    const k = experimentKeys(code, experiment);
    const [state, agg, ...listValues] = await Promise.all([
      this.redis.hgetall(sessionKeys(code).state),
      this.redis.hgetall(k.agg),
      ...lists.map((l) => this.redis.lrange(k.list(l.name), 0, l.read - 1)),
    ]);
    const hash: Record<string, number> = {};
    for (const [field, value] of Object.entries(agg ?? {})) if (field !== "_v") hash[field] = toCounter(value);
    const listMap: Record<string, string[]> = {};
    lists.forEach((l, i) => {
      listMap[l.name] = (listValues[i] ?? []).map(String);
    });
    return { version: `${toCounter(state?.ver)}:${toCounter(agg?._v)}`, hash, lists: listMap };
  }

  async submit(code: string, request: SubmitRequest): Promise<SubmitOutcome> {
    const k = experimentKeys(code, request.experiment);
    const { plan } = request;
    const pushes = plan.push ?? [];
    const keys = [sessionKeys(code).state, k.agg, k.dev, k.pending, ...pushes.map((p) => k.list(p.list))];
    const incr = Object.entries(plan.incr);
    const slot = plan.deviceSlot ? `${request.deviceId}:${plan.deviceSlot}` : request.deviceId;
    const args = [
      request.experiment,
      slot,
      String(request.limit),
      String(plan.revealGuard ?? 0),
      plan.useAssignment ? "1" : "0",
      request.deviceId,
      String(Date.now()),
      TTL,
      String(incr.length),
      ...incr.flatMap(([field, by]) => [field, String(by)]),
      String(pushes.length),
      ...pushes.flatMap((p) => [String(p.cap), String(p.items.length), ...p.items]),
    ];
    const result = await this.redis.eval(SUBMIT.lua, keys, args);
    const [kind, variant] = Array.isArray(result) ? result.map(String) : [String(result), ""];
    if (!OUTCOMES.has(kind)) throw new Error(`Unexpected submit result: ${kind}`);
    return kind === "accepted" ? { kind, variant: variant ?? "" } : ({ kind } as SubmitOutcome);
  }

  async setAssignment(code: string, experiment: ExperimentId, deviceId: string, variant: string, ttlMs: number) {
    const expiresAt = Date.now() + ttlMs;
    await this.redis.eval(SET_ASSIGNMENT.lua, [experimentKeys(code, experiment).pending], [deviceId, `${variant}|${expiresAt}`, TTL]);
  }

  private experimentDataKeys(code: string, experiment: ExperimentId, lists: readonly string[]): string[] {
    const k = experimentKeys(code, experiment);
    return [k.agg, k.dev, k.pending, ...lists.map((l) => k.list(l))];
  }

  async resetExperiment(code: string, experiment: ExperimentId, lists: readonly string[]): Promise<void> {
    const keys = [sessionKeys(code).state, ...this.experimentDataKeys(code, experiment, lists)];
    await this.redis.eval(RESET_EXPERIMENT.lua, keys, [experiment, TTL]);
  }

  async resetAll(code: string, lists: Readonly<Record<ExperimentId, readonly string[]>>): Promise<void> {
    const s = sessionKeys(code);
    const keys = [s.state, s.people, ...EXPERIMENT_IDS.flatMap((id) => this.experimentDataKeys(code, id, lists[id]))];
    await this.redis.eval(RESET_ALL.lua, keys, [TTL]);
  }
}
