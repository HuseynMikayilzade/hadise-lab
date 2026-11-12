import { z } from "zod";
import { error, json, readJson, resolveSessionCode, STORE_UNAVAILABLE, type RouteContext } from "@/lib/http";
import { getStore } from "@/lib/session";

const JoinSchema = z.object({ deviceId: z.uuid() });

/** İştirakçı sayı üçün anonim cihaz identifikatoru HyperLogLog-a əlavə olunur. */
export async function POST(request: Request, context: RouteContext) {
  const code = await resolveSessionCode(context);
  if (!code) return error(404, "session_not_found", "Sessiya tapılmadı.");
  const parsed = JoinSchema.safeParse(await readJson(request));
  if (!parsed.success) return error(422, "invalid_device", "Cihaz identifikatoru yanlışdır.");

  try {
    await getStore().join(code, parsed.data.deviceId);
    return json({ ok: true });
  } catch (e) {
    console.error("[join] failed", e);
    return STORE_UNAVAILABLE();
  }
}
