import { EXPERIMENTS } from "@/experiments/registry";
import type { ExperimentId } from "@/experiments/types";
import { EngineRun } from "@/lib/engine/runner";
import { TICK_MS, type FromWorker, type Speed, type ToWorker } from "./protocol";

/**
 * Simulyasiya mühərriki: təqdimatçının brauzerində, ayrıca axında işləyir ki, 1000 sınaq/s
 * sürətində də göstəriş donmasın. UI-yə ən çox 10 kadr/s xülasə göndərilir.
 */
interface WorkerScope {
  postMessage(message: FromWorker): void;
  addEventListener(type: "message", listener: (event: MessageEvent<ToWorker>) => void): void;
}
const scope = self as unknown as WorkerScope;

const runs = new Map<ExperimentId, EngineRun>();
let current: EngineRun | null = null;
let running = false;
let tps: Speed = 10;
let carry = 0;
let dirty = false;

function post(message: FromWorker) {
  scope.postMessage(message);
}

function publish() {
  if (!current) return;
  dirty = false;
  post({
    type: "snapshot",
    snapshot: {
      exp: current.id,
      runId: current.runId,
      running,
      tps,
      trials: current.trials,
      seed: current.seed,
      params: { ...current.params },
      revealed: current.revealed,
      summary: current.summarize(),
    },
  });
}

setInterval(() => {
  if (current && running) {
    carry += (tps * TICK_MS) / 1000;
    const whole = Math.floor(carry);
    if (whole > 0) {
      carry -= whole;
      current.step(whole);
      dirty = true;
    }
  }
  if (dirty) publish();
}, TICK_MS);

function handle(message: ToWorker) {
  switch (message.type) {
    case "init": {
      let run = runs.get(message.exp);
      if (!run || run.seed !== message.seed) {
        run = new EngineRun(EXPERIMENTS[message.exp], message.seed);
        runs.set(message.exp, run);
      }
      if (current !== run) running = false;
      current = run;
      carry = 0;
      break;
    }
    case "start":
      running = true;
      break;
    case "pause":
      running = false;
      break;
    case "step":
      current?.step(message.trials);
      break;
    case "speed":
      tps = message.tps;
      break;
    case "newTruth":
      current?.restart(message.seed);
      carry = 0;
      break;
    case "reveal":
      current?.reveal();
      break;
    case "param":
      current?.setParam(message.key, message.value);
      break;
    case "audience":
      runs.get(message.exp)?.addAudience(message.outcomes);
      break;
  }
  dirty = true;
  publish();
}

scope.addEventListener("message", (event: MessageEvent<ToWorker>) => {
  try {
    handle(event.data);
  } catch (e) {
    post({ type: "error", message: e instanceof Error ? e.message : String(e) });
  }
});

post({ type: "ready" });
