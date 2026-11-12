/**
 * Store-un istifadə etdiyi minimal Redis əmrləri. Upstash müştərisi, yaddaşdakı əkiz
 * və əmr sayğacı eyni interfeysi həyata keçirir.
 */
export interface RedisLike {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
  hgetall(key: string): Promise<Record<string, unknown> | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  pfcount(key: string): Promise<number>;
}

/** Sorğuları sayan sarğı - 15 dəqiqəlik çıxış üçün Redis büdcəsini ölçmək üçün. */
export class CountingRedis implements RedisLike {
  commands = 0;
  readonly byName: Record<string, number> = {};

  constructor(private readonly inner: RedisLike) {}

  private count(name: string) {
    this.commands += 1;
    this.byName[name] = (this.byName[name] ?? 0) + 1;
  }

  eval(script: string, keys: string[], args: string[]) {
    this.count("eval");
    return this.inner.eval(script, keys, args);
  }
  hgetall(key: string) {
    this.count("hgetall");
    return this.inner.hgetall(key);
  }
  lrange(key: string, start: number, stop: number) {
    this.count("lrange");
    return this.inner.lrange(key, start, stop);
  }
  pfcount(key: string) {
    this.count("pfcount");
    return this.inner.pfcount(key);
  }
}
