import { Redis } from "@upstash/redis";
import type { RedisLike } from "./redis-like";

/**
 * HGETALL cavabını həmişə { sahə: dəyər } obyektinə çevirir.
 *
 * Upstash müştərisi `automaticDeserialization: false` ilə HGETALL üçün düz massiv qaytarır
 * (["active", "venn", "ver", "1"]), avtomatik rejimdə isə obyekt. Store hər iki formanı eyni qəbul etməlidir:
 * əks halda vəziyyət boş oxunur (version 0, active null), halbuki yazma uğurlu olub.
 */
export function toHashObject(value: unknown): Record<string, string> | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const result: Record<string, string> = {};
    for (let i = 0; i + 1 < value.length; i += 2) result[String(value[i])] = String(value[i + 1]);
    return result;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return null;
    return Object.fromEntries(entries.map(([k, v]) => [k, String(v)]));
  }
  throw new Error(`Unexpected HGETALL result: ${typeof value}`);
}

/**
 * Upstash müştərisi → RedisLike. Production və real-Redis müqavilə testləri MƏHZ bu adapteri istifadə edir.
 * Avtomatik JSON çevrilməsi söndürülür: siyahı elementləri ("0.1234,0.5", "GRGR...") sətir qalmalıdır.
 */
export function createUpstashRedis(url: string, token: string): RedisLike {
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return {
    eval: (script, keys, args) => redis.eval(script, keys, args),
    hgetall: async (key) => toHashObject(await redis.hgetall(key)),
    lrange: async (key, start, stop) => (await redis.lrange<string>(key, start, stop)).map(String),
    pfcount: (key) => redis.pfcount(key),
  };
}
