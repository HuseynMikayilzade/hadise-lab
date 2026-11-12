import type { RedisLike } from "./redis-like";
import { ALL_SCRIPTS, type MemoryDb, type ScriptDef } from "./scripts";

/**
 * Yaddaşdakı Redis əkizi: yalnız lokal inkişaf və testlər üçün. Serverless mühitdə
 * hər instansiyanın öz yaddaşı olduğundan istifadə edilə bilməz - store/index.ts bunun qarşısını alır.
 * EVAL çağırışları eyni skriptin JS əkizinə yönləndirilir.
 */
export class MemoryRedis implements RedisLike {
  private readonly db: MemoryDb = { hashes: new Map(), lists: new Map(), sets: new Map() };
  private readonly scripts: Map<string, ScriptDef>;

  constructor(scripts: readonly ScriptDef[] = ALL_SCRIPTS) {
    this.scripts = new Map(scripts.map((s) => [s.lua, s]));
  }

  async eval(script: string, keys: string[], args: string[]): Promise<unknown> {
    const def = this.scripts.get(script);
    if (!def) throw new Error("Unknown script");
    return def.js(this.db, keys, args);
  }

  async hgetall(key: string): Promise<Record<string, unknown> | null> {
    const h = this.db.hashes.get(key);
    return h && h.size > 0 ? Object.fromEntries(h) : null;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.db.lists.get(key) ?? [];
    return list.slice(start, stop < 0 ? list.length + stop + 1 : stop + 1);
  }

  async pfcount(key: string): Promise<number> {
    return this.db.sets.get(key)?.size ?? 0;
  }

  /** Testlər üçün: mövcud açarların siyahısı. */
  keys(): string[] {
    return [...this.db.hashes.keys(), ...this.db.lists.keys(), ...this.db.sets.keys()];
  }
}
