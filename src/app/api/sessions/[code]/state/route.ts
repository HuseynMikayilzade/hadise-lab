import { error, json, resolveSessionCode, STORE_UNAVAILABLE, type RouteContext } from "@/lib/http";
import { getStore } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Telefonlar və ekran üçün yüngül vəziyyət. ?v= cari versiyadırsa, yalnız { unchanged: true } qaytarılır. */
export async function GET(request: Request, context: RouteContext) {
  const code = await resolveSessionCode(context);
  if (!code) return error(404, "session_not_found", "Sessiya tapılmadı.");

  try {
    const state = await getStore().getState(code);
    const known = new URL(request.url).searchParams.get("v");
    // İştirakçı sayı versiyaya daxil deyil, ona görə onu "dəyişməyib" cavabında da qaytarırıq.
    if (known !== null && known === String(state.version)) {
      return json({ unchanged: true, version: state.version, participants: state.participants });
    }
    return json(state);
  } catch (e) {
    console.error("[state] read failed", e);
    return STORE_UNAVAILABLE();
  }
}
