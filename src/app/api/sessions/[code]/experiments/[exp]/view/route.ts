import { error, json, resolveExperimentRoute, STORE_UNAVAILABLE, type ExperimentRouteContext } from "@/lib/http";
import { getStore } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Proyektor üçün aqreqat görünüş. Fərdi cavablar heç vaxt qaytarılmır. */
export async function GET(request: Request, context: ExperimentRouteContext) {
  const route = await resolveExperimentRoute(context);
  if (!route) return error(404, "experiment_not_found", "Eksperiment tapılmadı.");
  const { code, experiment } = route;

  try {
    const store = getStore();
    const [aggregate, state] = await Promise.all([
      store.getAggregate(code, experiment.id, experiment.lists),
      store.getState(code),
    ]);
    const known = new URL(request.url).searchParams.get("v");
    if (known !== null && known === aggregate.version) return json({ unchanged: true, version: aggregate.version });

    const control = state.controls[experiment.id];
    const view = experiment.computeView(experiment.decodeAggregate(aggregate), control);
    return json({ version: aggregate.version, control, view });
  } catch (e) {
    console.error("[view] read failed", e);
    return STORE_UNAVAILABLE();
  }
}
