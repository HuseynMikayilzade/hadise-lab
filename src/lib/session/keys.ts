import type { ExperimentId } from "@/experiments/types";

/** Məlumat bir həftə sonra avtomatik silinir - şəxsi məlumat toplanmır, amma yığılmasın. */
export const TTL_SECONDS = 60 * 60 * 24 * 7;

export const sessionKeys = (code: string) => ({
  state: `hl:${code}:state`,
  people: `hl:${code}:people`,
});

export const experimentKeys = (code: string, exp: ExperimentId) => ({
  agg: `hl:${code}:x:${exp}:agg`,
  dev: `hl:${code}:x:${exp}:dev`,
  pending: `hl:${code}:x:${exp}:pending`,
  list: (name: string) => `hl:${code}:x:${exp}:list:${name}`,
});
