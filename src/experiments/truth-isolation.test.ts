import { describe, expect, it } from "vitest";
import { seededRng } from "@/lib/engine/rng";
import { EXPERIMENTS } from "./registry";
import { EXPERIMENT_IDS, type AnyExperiment, type EngineParams } from "./types";

/**
 * Gizli həqiqətin sızmaması: summarize() bütün təxminləri YALNIZ modeldən hesablamalıdır.
 * Həqiqət "Gizli parametri göstər"dən sonra ötürülsə belə, o, yalnız ayrıca `truth` sahəsində
 * müqayisə üçün görünə bilər - heç bir təxminə təsir etməməlidir.
 */

function params(def: AnyExperiment): EngineParams {
  return Object.fromEntries((def.engine?.params ?? []).map((p) => [p.key, p.initial]));
}

/** Xülasədən `truth` sahəsini (istənilən dərinlikdə deyil, yalnız yuxarı səviyyədə) çıxarır. */
function omitTruth(summary: unknown): unknown {
  if (summary === null || typeof summary !== "object") return summary;
  const { truth: _truth, ...rest } = summary as Record<string, unknown>;
  return rest;
}

/** Float64Array və digər strukturlar daxil olmaqla modelin dərin surəti (müqayisə üçün). */
function snapshot(model: unknown): unknown {
  return structuredClone(model);
}

function trained(def: AnyExperiment, seed: number, trials = 3000) {
  const engine = def.engine!;
  const rng = seededRng(seed);
  const p = params(def);
  const truth = engine.drawHiddenTruth(rng, p);
  const model = engine.initModel(p);
  for (let i = 0; i < trials; i += 1) engine.updateModel(model, engine.runTrial(truth, rng, p, model), "sim");
  return { engine, truth, model, p };
}

describe.each(EXPERIMENT_IDS)("truth isolation: %s", (id) => {
  const def = EXPERIMENTS[id];

  it("estimates are identical with and without the revealed truth", () => {
    const { engine, truth, model, p } = trained(def, 101);
    const hidden = engine.summarize(model, null, p);
    const revealed = engine.summarize(model, truth, p);
    expect(omitTruth(revealed)).toEqual(omitTruth(hidden));
  });

  it("a truth that did not generate the data cannot change any estimate", () => {
    const { engine, model, p } = trained(def, 202);
    const other = engine.drawHiddenTruth(seededRng(999_999), p);
    const hidden = engine.summarize(model, null, p);
    const withOther = engine.summarize(model, other, p);
    expect(omitTruth(withOther)).toEqual(omitTruth(hidden));
  });

  it("summarize() does not mutate the model", () => {
    const { engine, truth, model, p } = trained(def, 303);
    const before = snapshot(model);
    engine.summarize(model, null, p);
    engine.summarize(model, truth, p);
    expect(snapshot(model)).toEqual(before);
  });

  it("the hidden summary exposes no truth", () => {
    const { engine, model, p } = trained(def, 404);
    const hidden = engine.summarize(model, null, p) as Record<string, unknown>;
    expect(hidden.truth ?? null).toBeNull();
  });
});
