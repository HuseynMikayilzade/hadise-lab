import { Redis } from "@upstash/redis";
import { describe, expect, it } from "vitest";
import { EXPERIMENTS, LIST_NAMES } from "@/experiments/registry";
import { seededRng } from "@/lib/engine/rng";
import { RedisLabStore } from "./lab-store";
import { MemoryRedis } from "./memory-redis";
import { CountingRedis, type RedisLike } from "./redis-like";
import type { LabStore, SubmitRequest } from "./types";
import type { ExperimentId } from "@/experiments/types";

/**
 * Store müqaviləsi iki backend üzərində yoxlanılır:
 * - yaddaşdakı əkiz (Lua skriptlərinin JS əkizləri) - həmişə;
 * - real Redis (Upstash) - yalnız REDIS_TEST_URL / REDIS_TEST_TOKEN verildikdə (Lua skriptləri real icra olunur).
 */
const backends: { name: string; create: () => RedisLike }[] = [{ name: "memory twin", create: () => new MemoryRedis() }];
if (process.env.REDIS_TEST_URL && process.env.REDIS_TEST_TOKEN) {
  const redis = new Redis({ url: process.env.REDIS_TEST_URL, token: process.env.REDIS_TEST_TOKEN, automaticDeserialization: false });
  backends.push({
    name: "upstash",
    create: () => ({
      eval: (s, k, a) => redis.eval(s, k, a),
      hgetall: (k) => redis.hgetall<Record<string, unknown>>(k),
      lrange: (k, a, b) => redis.lrange<string>(k, a, b),
      pfcount: (k) => redis.pfcount(k),
    }),
  });
}

function request(store: LabStore, code: string, exp: ExperimentId, deviceId: string, input: unknown) {
  const def = EXPERIMENTS[exp];
  const plan = def.planSubmission(input, seededRng(1));
  const req: SubmitRequest = { experiment: exp, deviceId, limit: def.perDeviceLimit, lists: LIST_NAMES[exp], plan };
  return store.submit(code, req);
}

for (const backend of backends) {
  describe(`LabStore contract (${backend.name})`, () => {
    const make = () => new RedisLabStore(backend.create());
    const code = () => `test-${Math.random().toString(36).slice(2, 10)}`;

    it("rejects submissions for an inactive experiment", async () => {
      const store = make();
      const c = code();
      expect(await request(store, c, "venn", "d1", { a: true, b: false })).toEqual({ kind: "inactive" });
    });

    it("accepts once per device and counts atomically", async () => {
      const store = make();
      const c = code();
      await store.updateState(c, { active: "venn" });
      expect((await request(store, c, "venn", "d1", { a: true, b: false })).kind).toBe("accepted");
      expect((await request(store, c, "venn", "d1", { a: true, b: true })).kind).toBe("limit");
      expect((await request(store, c, "venn", "d2", { a: true, b: true })).kind).toBe("accepted");
      const agg = await store.getAggregate(c, "venn", []);
      expect(agg.hash).toEqual({ aOnly: 1, both: 1 });
    });

    it("respects closed status and reveal guard", async () => {
      const store = make();
      const c = code();
      await store.updateState(c, { active: "bayes-test", experiment: "bayes-test", control: { status: "closed" } });
      expect((await request(store, c, "bayes-test", "d1", { guess: 40 })).kind).toBe("closed");
      await store.updateState(c, { experiment: "bayes-test", control: { status: "open", reveal: 1 } });
      expect((await request(store, c, "bayes-test", "d1", { guess: 40 })).kind).toBe("revealed");
    });

    it("A/B submissions use the server-side assignment and consume it", async () => {
      const store = make();
      const c = code();
      await store.updateState(c, { active: "ab-test" });
      expect((await request(store, c, "ab-test", "d1", { clicked: true })).kind).toBe("no_assignment");
      await store.setAssignment(c, "ab-test", "d1", "b", 60_000);
      expect(await request(store, c, "ab-test", "d1", { clicked: true })).toEqual({ kind: "accepted", variant: "b" });
      expect((await request(store, c, "ab-test", "d1", { clicked: true })).kind).toBe("no_assignment");
      await store.setAssignment(c, "ab-test", "d1", "c", -1);
      expect((await request(store, c, "ab-test", "d1", { clicked: false })).kind).toBe("no_assignment");
      const agg = await store.getAggregate(c, "ab-test", []);
      expect(agg.hash).toEqual({ "shows:b": 1, "clicks:b": 1 });
    });

    it("capped lists keep the newest items", async () => {
      const store = make();
      const c = code();
      await store.updateState(c, { active: "monte-carlo" });
      for (let i = 0; i < 3; i += 1) await request(store, c, "monte-carlo", `d${i}`, {});
      const agg = await store.getAggregate(c, "monte-carlo", [{ name: "pts", read: 2000 }]);
      expect(agg.hash.total).toBe(300);
      expect(agg.lists.pts).toHaveLength(300);
    });

    it("experiment reset clears agg, dev, lists and pending, and bumps the version", async () => {
      const store = make();
      const c = code();
      await store.updateState(c, { active: "monte-carlo", experiment: "monte-carlo", control: { reveal: 1, step: 2 } });
      await request(store, c, "monte-carlo", "d1", {});
      await store.setAssignment(c, "monte-carlo", "d1", "x", 60_000);
      const before = await store.getState(c);
      const aggBefore = await store.getAggregate(c, "monte-carlo", [{ name: "pts", read: 2000 }]);

      await store.resetExperiment(c, "monte-carlo", LIST_NAMES["monte-carlo"]);

      const after = await store.getState(c);
      const aggAfter = await store.getAggregate(c, "monte-carlo", [{ name: "pts", read: 2000 }]);
      expect(after.version).toBeGreaterThan(before.version);
      expect(after.controls["monte-carlo"]).toMatchObject({ reveal: 0, step: 0, status: "open", epoch: 1 });
      expect(aggAfter.hash).toEqual({});
      expect(aggAfter.lists.pts).toEqual([]);
      expect(aggAfter.version).not.toBe(aggBefore.version);
      // Cihaz limiti də sıfırlanıb: eyni cihaz yenidən göndərə bilər.
      expect((await request(store, c, "monte-carlo", "d1", {})).kind).toBe("accepted");
    });

    it("full reset keeps the version monotonic", async () => {
      const store = make();
      const c = code();
      await store.updateState(c, { active: "venn" });
      await store.join(c, "d1");
      const before = await store.getState(c);
      await store.resetAll(c, LIST_NAMES);
      const after = await store.getState(c);
      expect(after.version).toBeGreaterThan(before.version);
      expect(after.active).toBeNull();
      expect(after.participants).toBe(0);
      expect(after.generation).toBe(after.version);
    });
  });
}

describe("memory twin reset leaves no experiment keys behind", () => {
  it("deletes every key of the experiment", async () => {
    const redis = new MemoryRedis();
    const store = new RedisLabStore(redis);
    await store.updateState("s1", { active: "monte-carlo" });
    const def = EXPERIMENTS["monte-carlo"];
    await store.submit("s1", { experiment: "monte-carlo", deviceId: "d", limit: 10, lists: ["pts"], plan: def.planSubmission({}, seededRng(2)) });
    await store.setAssignment("s1", "monte-carlo", "d", "x", 1000);
    expect(redis.keys().filter((k) => k.includes(":x:monte-carlo:"))).toHaveLength(4);
    await store.resetExperiment("s1", "monte-carlo", ["pts"]);
    expect(redis.keys().filter((k) => k.includes(":x:monte-carlo:"))).toHaveLength(0);
  });
});

/**
 * 15 dəqiqəlik çıxışın Redis büdcəsi: 35 telefon hər 2,5 s vəziyyəti, proyektor hər 2 s vəziyyəti
 * və aktiv eksperimentin görünüşünü sorğulayır; hər eksperimentdə hamı cavab verir.
 */
describe("Redis budget for a 15-minute talk", () => {
  it("stays well under the Upstash free tier", async () => {
    const counter = new CountingRedis(new MemoryRedis());
    const store = new RedisLabStore(counter);
    const c = "budget";
    const phones = 35;
    const seconds = 15 * 60;
    for (let p = 0; p < phones; p += 1) await store.join(c, `d${p}`);
    const order: ExperimentId[] = ["venn", "dice", "bayes-test", "ab-test", "birthday", "monte-carlo"];
    const perExperiment = seconds / order.length;
    const rng = seededRng(9);
    for (let t = 0; t < seconds; t += 1) {
      const exp = order[Math.floor(t / perExperiment)];
      if (t % perExperiment === 0) await store.updateState(c, { active: exp });
      if (t % 5 === 0) {
        // Telefonlar: 35 / 2,5 s = 14 sorğu/s
        for (let i = 0; i < 70; i += 1) await store.getState(c);
      }
      if (t % 2 === 0) {
        await store.getState(c);
        await store.getAggregate(c, exp, EXPERIMENTS[exp].lists);
      }
      // Bir neçə göndəriş: hər telefon hər eksperimentdə orta hesabla 3 dəfə.
      if (rng.next() < (phones * 3) / perExperiment) {
        const d = `d${rng.int(phones)}`;
        if (exp === "ab-test") await store.setAssignment(c, exp, d, "a", 60_000);
        const input = exp === "venn" ? { a: true, b: false } : exp === "bayes-test" ? { guess: 10 } : exp === "birthday" ? { day: 1, month: 1, guess: "30-50" } : exp === "ab-test" ? { clicked: true } : {};
        await store.submit(c, { experiment: exp, deviceId: d, limit: EXPERIMENTS[exp].perDeviceLimit, lists: LIST_NAMES[exp], plan: EXPERIMENTS[exp].planSubmission(input, rng) });
      }
    }
    console.log(`[budget] ${counter.commands} Redis commands for one simulated 15-minute talk`, counter.byName);
    (globalThis as { __redisBudget?: number }).__redisBudget = counter.commands;
    expect(counter.commands).toBeLessThan(60_000);
  });
});
