"use client";

import { BlockedCard, FormError, PhoneScreen, PrimaryButton } from "@/components/phone/PhoneParts";
import { usePhoneSubmit } from "@/components/phone/usePhoneSubmit";
import { formatDecimal } from "@/lib/format";
import type { Point } from "@/lib/stats/montecarlo";
import type { PhoneProps } from "../ui-types";
import { monteCarlo, POINTS_PER_TAP } from "./definition";
import { PointSquare } from "./PointSquare";

export function MonteCarloPhone({ code, exp, deviceId, scope }: PhoneProps<never>) {
  const { receipts, phase, error, blocked, submit } = usePhoneSubmit<{ points: Point[]; inside: number }>(code, exp, deviceId, scope);
  const left = monteCarlo.perDeviceLimit - receipts.length;
  const last = receipts[receipts.length - 1];
  const inside = receipts.reduce((s, r) => s + r.inside, 0);
  const total = receipts.length * POINTS_PER_TAP;

  return (
    <PhoneScreen
      title={monteCarlo.title}
      instruction={monteCarlo.phoneInstruction}
      action={
        left > 0 && !blocked ? (
          <PrimaryButton disabled={phase === "sending"} onClick={() => void submit({})}>
            {phase === "sending" ? "Atılır…" : `100 nöqtə at (${left} qaldı)`}
          </PrimaryButton>
        ) : undefined
      }
    >
      <PointSquare points={last?.points ?? []} size={300} />
      {last && (
        <p className="result-line">
          Son atış: {last.inside} / {POINTS_PER_TAP} dairədə. Sizin π təxmininiz: <strong>{formatDecimal((4 * inside) / total, 2)}</strong>
        </p>
      )}
      {(left <= 0 || blocked) && <BlockedCard message={blocked ?? "Bütün nöqtələriniz atıldı"} />}
      <FormError message={error} />
    </PhoneScreen>
  );
}
