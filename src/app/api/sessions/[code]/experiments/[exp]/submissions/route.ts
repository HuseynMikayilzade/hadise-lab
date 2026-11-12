import { z } from "zod";
import { LIST_NAMES } from "@/experiments/registry";
import { serverRng } from "@/lib/engine/server-rng";
import { error, json, readJson, resolveExperimentRoute, STORE_UNAVAILABLE, type ExperimentRouteContext } from "@/lib/http";
import { getStore } from "@/lib/session";

const EnvelopeSchema = z.object({ deviceId: z.uuid(), input: z.unknown() });

const REJECTIONS = {
  inactive: [409, "experiment_inactive", "Bu eksperiment hazırda aktiv deyil."],
  closed: [423, "session_closed", "Səsvermə bağlanıb."],
  revealed: [423, "answer_revealed", "Cavab artıq göstərilib."],
  limit: [409, "limit_reached", "Bu cihaz üçün limit dolub."],
  no_assignment: [409, "no_assignment", "Əvvəlcə reklam göstərilməlidir. Səhifəni yeniləyin."],
} as const;

export async function POST(request: Request, context: ExperimentRouteContext) {
  const route = await resolveExperimentRoute(context);
  if (!route) return error(404, "experiment_not_found", "Eksperiment tapılmadı.");
  const { code, experiment } = route;

  const envelope = EnvelopeSchema.safeParse(await readJson(request));
  if (!envelope.success) return error(400, "invalid_request", "Sorğunun formatı yanlışdır.");
  const input = experiment.inputSchema.safeParse(envelope.data.input);
  if (!input.success) return error(422, "invalid_answer", "Cavab yanlışdır. Seçimlərinizi yoxlayın.");

  // Təsadüfilik (zər, nöqtələr) burada, serverdə yaranır.
  const plan = experiment.planSubmission(input.data, serverRng);

  try {
    const outcome = await getStore().submit(code, {
      experiment: experiment.id,
      deviceId: envelope.data.deviceId,
      limit: experiment.perDeviceLimit,
      lists: LIST_NAMES[experiment.id],
      plan,
    });
    if (outcome.kind !== "accepted") {
      const [status, errorCode, message] = REJECTIONS[outcome.kind];
      return error(status, errorCode, message);
    }
    const receipt = plan.useAssignment ? { ...(plan.receipt as object), variant: outcome.variant } : plan.receipt;
    return json({ result: "accepted", receipt }, 201);
  } catch (e) {
    console.error("[submissions] failed", e);
    return STORE_UNAVAILABLE();
  }
}
