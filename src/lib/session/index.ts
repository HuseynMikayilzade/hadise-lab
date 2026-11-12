import { Redis } from "@upstash/redis";
import { RedisLabStore } from "./lab-store";
import { MemoryRedis } from "./memory-redis";
import type { RedisLike } from "./redis-like";
import type { LabStore } from "./types";

export type { LabStore, SessionState, SubmitOutcome } from "./types";

const globalForStore = globalThis as unknown as { labStore?: LabStore };

/** Upstash müştərisini RedisLike interfeysinə uyğunlaşdırır. */
function upstashAdapter(redis: Redis): RedisLike {
  return {
    eval: (script, keys, args) => redis.eval(script, keys, args),
    hgetall: (key) => redis.hgetall<Record<string, unknown>>(key),
    lrange: (key, start, stop) => redis.lrange<string>(key, start, stop),
    pfcount: (key) => redis.pfcount(key),
  };
}

/**
 * Upstash açarları varsa Redis, yoxdursa (yalnız lokal) yaddaş istifadə olunur.
 * Vercel Marketplace inteqrasiyası KV_REST_API_* adları ilə də əlavə edə bilər.
 */
function createStore(): LabStore {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (url && token) {
    // Avtomatik JSON çevrilməsi söndürülür: siyahı elementləri ("0.1234,0.5") sətir qalmalıdır.
    return new RedisLabStore(upstashAdapter(new Redis({ url, token, automaticDeserialization: false })));
  }
  if (process.env.VERCEL) {
    throw new Error("Upstash Redis is not configured. Add the Upstash integration in Vercel (Storage tab) and redeploy.");
  }
  return new RedisLabStore(new MemoryRedis());
}

export function getStore(): LabStore {
  globalForStore.labStore ??= createStore();
  return globalForStore.labStore;
}
