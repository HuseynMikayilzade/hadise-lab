import { RedisLabStore } from "./lab-store";
import { MemoryRedis } from "./memory-redis";
import type { LabStore } from "./types";
import { createUpstashRedis } from "./upstash";

export type { LabStore, SessionState, SubmitOutcome } from "./types";

const globalForStore = globalThis as unknown as { labStore?: LabStore };

/**
 * Upstash açarları varsa Redis, yoxdursa (yalnız lokal) yaddaş istifadə olunur.
 * Vercel Marketplace inteqrasiyası KV_REST_API_* adları ilə də əlavə edə bilər.
 */
function createStore(): LabStore {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (url && token) {
    return new RedisLabStore(createUpstashRedis(url, token));
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
