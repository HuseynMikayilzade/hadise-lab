import { z } from "zod";
import { EXPERIMENTS, LIST_NAMES } from "@/experiments/registry";
import { EXPERIMENT_IDS } from "@/experiments/types";
import { adminConfigured, isAuthorized } from "@/lib/admin-auth";
import { error, json, readJson, resolveSessionCode, STORE_UNAVAILABLE, type RouteContext } from "@/lib/http";
import { getStore } from "@/lib/session";

const ExpId = z.enum(EXPERIMENT_IDS);

const AdminSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setActive"), exp: ExpId.nullable() }),
  z.object({ action: z.literal("setMode"), exp: ExpId, mode: z.enum(["audience", "auto", "both"]) }),
  z.object({ action: z.enum(["open", "close", "reveal", "hide", "next", "prev", "reset"]), exp: ExpId }),
  z.object({ action: z.literal("resetAll") }),
]);

export async function POST(request: Request, context: RouteContext) {
  if (!adminConfigured()) return error(503, "admin_disabled", "ADMIN_TOKEN konfiqurasiya olunmayıb.");
  if (!isAuthorized(request)) return error(401, "unauthorized", "Açar yanlışdır.");

  const code = await resolveSessionCode(context);
  if (!code) return error(404, "session_not_found", "Sessiya tapılmadı.");

  const parsed = AdminSchema.safeParse(await readJson(request));
  if (!parsed.success) return error(422, "invalid_action", "Naməlum əməliyyat.");
  const body = parsed.data;
  const store = getStore();

  try {
    switch (body.action) {
      case "setActive":
        return json(await store.updateState(code, { active: body.exp }));
      case "setMode":
        return json(await store.updateState(code, { experiment: body.exp, control: { mode: body.mode } }));
      case "resetAll":
        await store.resetAll(code, LIST_NAMES);
        return json(await store.getState(code));
      case "reset":
        await store.resetExperiment(code, body.exp, LIST_NAMES[body.exp]);
        return json(await store.getState(code));
      default: {
        const state = await store.getState(code);
        const control = state.controls[body.exp];
        const steps = EXPERIMENTS[body.exp].steps ?? 1;
        const patch = {
          open: { status: "open" as const },
          close: { status: "closed" as const },
          // Viktorinada "Cavabı göstər" cari sualı açır; digərlərində sadəcə 1.
          reveal: { reveal: Math.max(control.reveal, control.step + 1) },
          hide: { reveal: 0 },
          next: { step: Math.min(steps - 1, control.step + 1) },
          prev: { step: Math.max(0, control.step - 1) },
        }[body.action];
        return json(await store.updateState(code, { experiment: body.exp, control: patch }));
      }
    }
  } catch (e) {
    console.error("[admin] action failed", e);
    return STORE_UNAVAILABLE();
  }
}
