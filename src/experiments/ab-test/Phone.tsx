"use client";

import { useCallback, useEffect, useState } from "react";
import { BlockedCard, FormError, PhoneScreen } from "@/components/phone/PhoneParts";
import { usePhoneSubmit } from "@/components/phone/usePhoneSubmit";
import { requestAssignment } from "@/lib/api-client";
import type { PhoneProps } from "../ui-types";
import { abTest, VARIANTS } from "./definition";
import { VARIANT_COLORS } from "./colors";

type Assignment = { variant: string; label: string; headline: string };

export function AbPhone({ code, exp, deviceId, scope }: PhoneProps<never>) {
  const { receipts, phase, error, setError, blocked, submit } = usePhoneSubmit<{ variant: string }>(code, exp, deviceId, scope);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(false);
  const left = abTest.perDeviceLimit - receipts.length;

  const fetchNext = useCallback(async () => {
    setLoading(true);
    const next = await requestAssignment(code, deviceId);
    setLoading(false);
    if (next) setAssignment(next);
    else setError("Reklam yüklənmədi. Yenidən cəhd edin.");
  }, [code, deviceId, setError]);

  useEffect(() => {
    if (left > 0 && !blocked) void fetchNext();
    // Yalnız ilk dəfə və sıfırlamadan (scope dəyişəndə) sonra.
  }, [scope]);

  async function answer(clicked: boolean) {
    const receipt = await submit({ clicked });
    if (receipt && left - 1 > 0) await fetchNext();
    else if (!receipt) setAssignment(null);
  }

  if (blocked || left <= 0) {
    return (
      <PhoneScreen title={abTest.title} instruction={abTest.phoneInstruction}>
        <BlockedCard message={blocked ?? "Təşəkkürlər! Bütün reklamlar göstərildi."} />
      </PhoneScreen>
    );
  }

  const index = Math.max(0, VARIANTS.findIndex((v) => v.id === assignment?.variant));
  return (
    <PhoneScreen
      title={abTest.title}
      instruction={abTest.phoneInstruction}
      action={
        <div className="action-pair">
          <button type="button" className="btn-secondary" disabled={!assignment || phase === "sending" || loading} onClick={() => void answer(false)}>
            Keç
          </button>
          <button type="button" className="btn-primary" disabled={!assignment || phase === "sending" || loading} onClick={() => void answer(true)}>
            Klik et
          </button>
        </div>
      }
    >
      {assignment ? (
        <article className="ad-card" style={{ borderColor: VARIANT_COLORS[index] }} aria-live="polite">
          <p className="ad-label">{assignment.label}</p>
          <p className="ad-headline">{assignment.headline}</p>
        </article>
      ) : (
        <div className="ad-empty">
          <p className="phone-hint">{loading ? "Alqoritm sizin üçün reklam seçir…" : "Reklam hazır deyil."}</p>
          {!loading && (
            <button type="button" className="btn-secondary" onClick={() => void fetchNext()}>
              Reklamı yüklə
            </button>
          )}
        </div>
      )}
      <p className="phone-hint">
        Göstərilən reklamlar: {receipts.length} / {abTest.perDeviceLimit}. Hər seçiminiz alqoritmin posteriorunu yeniləyir.
      </p>
      <FormError message={error} />
    </PhoneScreen>
  );
}
