"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExperimentId } from "@/experiments/types";
import { submitAnswer } from "@/lib/api-client";
import { readReceipts, storeReceipts } from "@/lib/device";

export type SubmitPhase = "idle" | "sending";

/**
 * Telefon göndərişi: qəbzlər yerli yaddaşda saxlanılır (səhifə yenilənəndə uğur ekranı itməsin),
 * limit və bağlanma halları aydın mesajla göstərilir.
 */
export function usePhoneSubmit<R>(code: string, exp: ExperimentId, deviceId: string, scope: string) {
  const [receipts, setReceipts] = useState<R[]>([]);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    setReceipts(readReceipts<R>(scope));
    setBlocked(null);
    setError("");
  }, [scope]);

  const submit = useCallback(
    async (input: unknown): Promise<R | null> => {
      setPhase("sending");
      setError("");
      const result = await submitAnswer<R>(code, exp, deviceId, input);
      setPhase("idle");
      if (result.ok) {
        setReceipts((previous) => {
          const next = [...previous, result.receipt];
          storeReceipts(scope, next);
          return next;
        });
        navigator.vibrate?.(30);
        return result.receipt;
      }
      if (["limit_reached", "session_closed", "answer_revealed", "experiment_inactive"].includes(result.code)) setBlocked(result.message);
      else setError(result.message);
      return null;
    },
    [code, exp, deviceId, scope],
  );

  return { receipts, phase, error, setError, blocked, submit };
}
