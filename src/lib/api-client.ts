import type { ExperimentId } from "@/experiments/types";

export type SubmitResult<R> =
  | { ok: true; receipt: R }
  | { ok: false; code: string; message: string; status: number };

const NETWORK_ERROR = "İnternet bağlantısını yoxlayın və yenidən göndərin.";

async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => null)) as T | { error?: { code?: string; message?: string } } | null;
  return { response, json };
}

export async function submitAnswer<R>(code: string, exp: ExperimentId, deviceId: string, input: unknown): Promise<SubmitResult<R>> {
  try {
    const { response, json } = await postJson<{ receipt: R }>(`/api/sessions/${code}/experiments/${exp}/submissions`, { deviceId, input });
    if (response.status === 201 && json && "receipt" in json) return { ok: true, receipt: json.receipt };
    const err = json && "error" in json ? json.error : undefined;
    return { ok: false, status: response.status, code: err?.code ?? "unknown", message: err?.message ?? "Cavab göndərilmədi. Yenidən cəhd edin." };
  } catch {
    return { ok: false, status: 0, code: "network", message: NETWORK_ERROR };
  }
}

export async function requestAssignment(code: string, deviceId: string) {
  try {
    const { response, json } = await postJson<{ variant: string; label: string; headline: string }>(
      `/api/sessions/${code}/experiments/ab-test/assign`,
      { deviceId },
    );
    if (response.ok && json && "variant" in json) return json;
    return null;
  } catch {
    return null;
  }
}

export async function joinSession(code: string, deviceId: string): Promise<void> {
  await postJson(`/api/sessions/${code}/join`, { deviceId }).catch(() => undefined);
}

export type AdminAction =
  | { action: "setActive"; exp: ExperimentId | null }
  | { action: "setMode"; exp: ExperimentId; mode: "audience" | "auto" | "both" }
  | { action: "open" | "close" | "reveal" | "hide" | "next" | "prev" | "reset"; exp: ExperimentId }
  | { action: "resetAll" };

export async function adminRequest<T>(code: string, token: string, action: AdminAction) {
  try {
    const { response, json } = await postJson<T>(`/api/sessions/${code}/admin`, action, { "x-admin-token": token });
    if (response.ok) return { ok: true as const, data: json as T };
    const err = json && typeof json === "object" && "error" in json ? (json as { error?: { message?: string } }).error : undefined;
    return { ok: false as const, status: response.status, message: err?.message ?? "Əməliyyat icra olunmadı." };
  } catch {
    return { ok: false as const, status: 0, message: "Server cavab vermədi." };
  }
}
