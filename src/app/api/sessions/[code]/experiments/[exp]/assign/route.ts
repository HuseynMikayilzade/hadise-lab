import { z } from "zod";
import { abTest, chooseVariantForVisitor, VARIANTS } from "@/experiments/ab-test/definition";
import { serverRng } from "@/lib/engine/server-rng";
import { error, json, readJson, resolveExperimentRoute, STORE_UNAVAILABLE, type ExperimentRouteContext } from "@/lib/http";
import { getStore } from "@/lib/session";

const AssignSchema = z.object({ deviceId: z.uuid() });
const ASSIGNMENT_TTL_MS = 5 * 60 * 1000;

/**
 * A/B testi: server auditoriya posteriorlarından Thompson nümunəsi ilə variant seçir və onu
 * cihaz üçün saxlayır. Telefon variantı göndərmir - göndəriş zamanı server saxlanmış təyinatı oxuyur.
 */
export async function POST(request: Request, context: ExperimentRouteContext) {
  const route = await resolveExperimentRoute(context);
  if (!route || route.experiment.id !== abTest.id) return error(404, "experiment_not_found", "Eksperiment tapılmadı.");
  const parsed = AssignSchema.safeParse(await readJson(request));
  if (!parsed.success) return error(422, "invalid_device", "Cihaz identifikatoru yanlışdır.");

  try {
    const store = getStore();
    const aggregate = await store.getAggregate(route.code, abTest.id, abTest.lists);
    const variant = chooseVariantForVisitor(abTest.decodeAggregate(aggregate), serverRng);
    await store.setAssignment(route.code, abTest.id, parsed.data.deviceId, variant, ASSIGNMENT_TTL_MS);
    const meta = VARIANTS.find((v) => v.id === variant)!;
    return json({ variant, label: meta.label, headline: meta.headline });
  } catch (e) {
    console.error("[assign] failed", e);
    return STORE_UNAVAILABLE();
  }
}
