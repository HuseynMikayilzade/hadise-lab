import { NextResponse } from "next/server";
import { getExperiment } from "@/experiments/registry";
import type { AnyExperiment } from "@/experiments/types";
import { isValidSessionCode } from "@/lib/session-code";

export type RouteContext = { params: Promise<{ code: string }> };
export type ExperimentRouteContext = { params: Promise<{ code: string; exp: string }> };

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function json<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function error(status: number, code: string, message: string) {
  return json({ error: { code, message } }, status);
}

function normalizeCode(code: string): string | null {
  const normalized = decodeURIComponent(code).trim().toLowerCase();
  return isValidSessionCode(normalized) ? normalized : null;
}

/** Sessiya kodunu normallaşdırır və yoxlayır; etibarsızdırsa null qaytarır. */
export async function resolveSessionCode(context: RouteContext): Promise<string | null> {
  const { code } = await context.params;
  return normalizeCode(code);
}

export async function resolveExperimentRoute(
  context: ExperimentRouteContext,
): Promise<{ code: string; experiment: AnyExperiment } | null> {
  const { code, exp } = await context.params;
  const normalized = normalizeCode(code);
  const experiment = getExperiment(exp);
  return normalized && experiment ? { code: normalized, experiment } : null;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export const STORE_UNAVAILABLE = () =>
  error(503, "store_unavailable", "Server müvəqqəti əlçatan deyil. Bir neçə saniyədən sonra yenidən cəhd edin.");
