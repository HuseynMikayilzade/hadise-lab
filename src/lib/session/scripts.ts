/**
 * Atomik Redis skriptləri. Hər Lua skriptinin JS əkizi var: yaddaşdakı store (lokal inkişaf, testlər)
 * eyni məntiqi icra edir. İki versiya eyni arqument formatını qəbul edir.
 */

export interface MemoryDb {
  hashes: Map<string, Map<string, string>>;
  lists: Map<string, string[]>;
  sets: Map<string, Set<string>>;
}

export interface ScriptDef {
  lua: string;
  js(db: MemoryDb, keys: string[], args: string[]): unknown;
}

const hash = (db: MemoryDb, key: string): Map<string, string> => {
  let h = db.hashes.get(key);
  if (!h) {
    h = new Map();
    db.hashes.set(key, h);
  }
  return h;
};

const hincrby = (db: MemoryDb, key: string, field: string, by: number): number => {
  const h = hash(db, key);
  const next = Number(h.get(field) ?? "0") + by;
  h.set(field, String(next));
  return next;
};

/** KEYS[1] = state; ARGV[1] = ttl, sonra sahə/dəyər cütləri. Qaytarır: yeni versiya. */
export const UPDATE_STATE: ScriptDef = {
  lua: `
for i = 2, #ARGV, 2 do redis.call('HSET', KEYS[1], ARGV[i], ARGV[i + 1]) end
local v = redis.call('HINCRBY', KEYS[1], 'ver', 1)
redis.call('EXPIRE', KEYS[1], ARGV[1])
return v`,
  js(db, keys, args) {
    const h = hash(db, keys[0]);
    for (let i = 1; i < args.length; i += 2) h.set(args[i], args[i + 1]);
    return hincrby(db, keys[0], "ver", 1);
  },
};

/** KEYS[1] = people (HyperLogLog); ARGV[1] = deviceId, ARGV[2] = ttl. */
export const JOIN: ScriptDef = {
  lua: `
redis.call('PFADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1`,
  js(db, keys, args) {
    let set = db.sets.get(keys[0]);
    if (!set) {
      set = new Set();
      db.sets.set(keys[0], set);
    }
    set.add(args[0]);
    return 1;
  },
};

/** KEYS[1] = pending; ARGV[1] = deviceId, ARGV[2] = "variant|bitmə vaxtı (ms)", ARGV[3] = ttl. */
export const SET_ASSIGNMENT: ScriptDef = {
  lua: `
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1`,
  js(db, keys, args) {
    hash(db, keys[0]).set(args[0], args[1]);
    return 1;
  },
};

/**
 * Göndəriş: aktivlik, status, açılış (reveal), cihaz limiti və A/B təyinatı yoxlanır,
 * sonra sayğaclar və siyahılar yenilənir - hamısı bir atomik addımda.
 *
 * KEYS: 1 state, 2 agg, 3 dev, 4 pending, 5.. siyahılar (push sırası ilə)
 * ARGV: 1 exp, 2 cihaz yuvası, 3 limit, 4 revealGuard, 5 useAssignment (0/1), 6 deviceId,
 *       7 indiki vaxt (ms), 8 ttl, 9 sayğac sayı, sonra sahə/artım cütləri,
 *       sonra push sayı, hər push üçün: cap, element sayı, elementlər
 */
export const SUBMIT: ScriptDef = {
  lua: `
local exp = ARGV[1]
if redis.call('HGET', KEYS[1], 'active') ~= exp then return {'inactive', ''} end
if redis.call('HGET', KEYS[1], 'status:' .. exp) == 'closed' then return {'closed', ''} end
local guard = tonumber(ARGV[4])
if guard > 0 then
  local revealed = tonumber(redis.call('HGET', KEYS[1], 'reveal:' .. exp) or '0')
  if revealed >= guard then return {'revealed', ''} end
end
local used = tonumber(redis.call('HGET', KEYS[3], ARGV[2]) or '0')
if used >= tonumber(ARGV[3]) then return {'limit', ''} end
local variant = ''
if ARGV[5] == '1' then
  local pending = redis.call('HGET', KEYS[4], ARGV[6])
  if not pending then return {'no_assignment', ''} end
  redis.call('HDEL', KEYS[4], ARGV[6])
  local sep = string.find(pending, '|', 1, true)
  if not sep then return {'no_assignment', ''} end
  if tonumber(string.sub(pending, sep + 1)) < tonumber(ARGV[7]) then return {'no_assignment', ''} end
  variant = string.sub(pending, 1, sep - 1)
end
redis.call('HINCRBY', KEYS[3], ARGV[2], 1)
local i = 10
for _ = 1, tonumber(ARGV[9]) do
  local field = string.gsub(ARGV[i], '{variant}', variant)
  redis.call('HINCRBY', KEYS[2], field, tonumber(ARGV[i + 1]))
  i = i + 2
end
local pushes = tonumber(ARGV[i])
i = i + 1
for p = 1, pushes do
  local key = KEYS[4 + p]
  local cap = tonumber(ARGV[i])
  local count = tonumber(ARGV[i + 1])
  i = i + 2
  for _ = 1, count do
    redis.call('LPUSH', key, ARGV[i])
    i = i + 1
  end
  redis.call('LTRIM', key, 0, cap - 1)
  redis.call('EXPIRE', key, ARGV[8])
end
redis.call('HINCRBY', KEYS[2], '_v', 1)
redis.call('EXPIRE', KEYS[2], ARGV[8])
redis.call('EXPIRE', KEYS[3], ARGV[8])
return {'accepted', variant}`,
  js(db, keys, args) {
    const state = hash(db, keys[0]);
    const exp = args[0];
    if (state.get("active") !== exp) return ["inactive", ""];
    if (state.get(`status:${exp}`) === "closed") return ["closed", ""];
    const guard = Number(args[3]);
    if (guard > 0 && Number(state.get(`reveal:${exp}`) ?? "0") >= guard) return ["revealed", ""];
    const dev = hash(db, keys[2]);
    if (Number(dev.get(args[1]) ?? "0") >= Number(args[2])) return ["limit", ""];
    let variant = "";
    if (args[4] === "1") {
      const pending = hash(db, keys[3]);
      const value = pending.get(args[5]);
      if (value === undefined) return ["no_assignment", ""];
      pending.delete(args[5]);
      const sep = value.indexOf("|");
      if (sep < 0 || Number(value.slice(sep + 1)) < Number(args[6])) return ["no_assignment", ""];
      variant = value.slice(0, sep);
    }
    hincrby(db, keys[2], args[1], 1);
    let i = 9;
    const incrCount = Number(args[8]);
    for (let n = 0; n < incrCount; n += 1) {
      hincrby(db, keys[1], args[i].replaceAll("{variant}", variant), Number(args[i + 1]));
      i += 2;
    }
    const pushes = Number(args[i]);
    i += 1;
    for (let p = 0; p < pushes; p += 1) {
      const key = keys[4 + p];
      const cap = Number(args[i]);
      const count = Number(args[i + 1]);
      i += 2;
      const list = db.lists.get(key) ?? [];
      for (let n = 0; n < count; n += 1) {
        list.unshift(args[i]);
        i += 1;
      }
      db.lists.set(key, list.slice(0, cap));
    }
    hincrby(db, keys[1], "_v", 1);
    return ["accepted", variant];
  },
};

/**
 * Bir eksperimenti sıfırlayır: agg, dev, pending və bütün siyahılar silinir,
 * idarəetmə sahələri (status, reveal, step) təmizlənir, versiya artır.
 * KEYS: 1 state, 2.. silinəcək açarlar; ARGV: 1 exp, 2 ttl.
 */
export const RESET_EXPERIMENT: ScriptDef = {
  lua: `
for i = 2, #KEYS do redis.call('DEL', KEYS[i]) end
local exp = ARGV[1]
redis.call('HDEL', KEYS[1], 'status:' .. exp, 'reveal:' .. exp, 'step:' .. exp)
redis.call('HINCRBY', KEYS[1], 'epoch:' .. exp, 1)
local v = redis.call('HINCRBY', KEYS[1], 'ver', 1)
redis.call('EXPIRE', KEYS[1], ARGV[2])
return v`,
  js(db, keys, args) {
    for (const key of keys.slice(1)) {
      db.hashes.delete(key);
      db.lists.delete(key);
      db.sets.delete(key);
    }
    const state = hash(db, keys[0]);
    for (const field of ["status", "reveal", "step"]) state.delete(`${field}:${args[0]}`);
    hincrby(db, keys[0], `epoch:${args[0]}`, 1);
    return hincrby(db, keys[0], "ver", 1);
  },
};

/**
 * Bütün sessiyanı sıfırlayır, lakin versiya sayğacını saxlayır (müştərilər köhnə versiyanı görməsin).
 * KEYS: 1 state, 2.. silinəcək açarlar; ARGV: 1 ttl.
 */
export const RESET_ALL: ScriptDef = {
  lua: `
local v = tonumber(redis.call('HGET', KEYS[1], 'ver') or '0') + 1
for i = 1, #KEYS do redis.call('DEL', KEYS[i]) end
redis.call('HSET', KEYS[1], 'ver', v, 'gen', v)
redis.call('EXPIRE', KEYS[1], ARGV[1])
return v`,
  js(db, keys) {
    const v = Number(hash(db, keys[0]).get("ver") ?? "0") + 1;
    for (const key of keys) {
      db.hashes.delete(key);
      db.lists.delete(key);
      db.sets.delete(key);
    }
    hash(db, keys[0]).set("ver", String(v));
    hash(db, keys[0]).set("gen", String(v));
    return v;
  },
};

export const ALL_SCRIPTS: readonly ScriptDef[] = [UPDATE_STATE, JOIN, SET_ASSIGNMENT, SUBMIT, RESET_EXPERIMENT, RESET_ALL];
