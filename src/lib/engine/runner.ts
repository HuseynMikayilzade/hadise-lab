import type { AnyExperiment, EngineParams, ExperimentId } from "@/experiments/types";
import { cryptoRng, seededRng, type RandomSource } from "./rng";

/**
 * Bir eksperimentin avtonom qaçışı: gizli həqiqət, model və sınaq sayğacı.
 * DOM və React-dan asılı deyil - həm Web Worker-də, həm testlərdə işləyir.
 */
export class EngineRun {
  private rng: RandomSource;
  private truth: unknown;
  private model: unknown;
  readonly params: EngineParams;
  trials = 0;
  revealed = false;
  runId = 0;
  seed: number | null;

  constructor(
    private readonly def: AnyExperiment,
    seed: number | null,
  ) {
    if (!def.engine) throw new Error(`Experiment ${def.id} has no engine`);
    this.params = Object.fromEntries((def.engine.params ?? []).map((p) => [p.key, p.initial]));
    this.seed = seed;
    this.rng = seed === null ? cryptoRng() : seededRng(seed);
    this.truth = null;
    this.model = null;
    this.restart(seed);
  }

  get id(): ExperimentId {
    return this.def.id;
  }

  /** Yeni gizli həqiqət çəkir və modeli sıfırlayır. */
  restart(seed: number | null): void {
    const engine = this.def.engine!;
    this.seed = seed;
    this.rng = seed === null ? cryptoRng() : seededRng(seed);
    this.truth = engine.drawHiddenTruth(this.rng, this.params);
    this.model = engine.initModel(this.params);
    this.trials = 0;
    this.revealed = false;
    this.runId += 1;
  }

  step(count: number): void {
    const engine = this.def.engine!;
    for (let i = 0; i < count; i += 1) {
      engine.updateModel(this.model, engine.runTrial(this.truth, this.rng, this.params, this.model), "sim");
    }
    this.trials += count;
  }

  /** Auditoriya müşahidələri ayrıca seriya kimi modelə əlavə olunur. */
  addAudience(outcomes: readonly unknown[]): void {
    const engine = this.def.engine!;
    for (const outcome of outcomes) engine.updateModel(this.model, outcome, "audience");
  }

  setParam(key: string, value: number): void {
    this.params[key] = value;
    if (this.def.engine!.resetOnParamChange) {
      this.model = this.def.engine!.initModel(this.params);
      this.trials = 0;
    }
  }

  reveal(): void {
    this.revealed = true;
  }

  summarize(): unknown {
    return this.def.engine!.summarize(this.model, this.revealed ? this.truth : null, this.params);
  }
}
