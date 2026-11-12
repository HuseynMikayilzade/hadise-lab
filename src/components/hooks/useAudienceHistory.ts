"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Server yalnız aqreqat saxlayır; auditoriyanın yaxınlaşma tarixçəsini ekran sorğular arasında özü toplayır.
 * n azalarsa (sıfırlama) tarixçə təmizlənir. Ən çox 500 nöqtə saxlanılır.
 */
export function useAudienceHistory<P extends { n: number }>(point: P | null): P[] {
  const [history, setHistory] = useState<P[]>([]);
  const lastN = useRef(0);

  useEffect(() => {
    if (!point) return;
    if (point.n < lastN.current) {
      lastN.current = point.n;
      setHistory(point.n > 0 ? [point] : []);
      return;
    }
    if (point.n === lastN.current || point.n === 0) return;
    lastN.current = point.n;
    setHistory((h) => (h.length >= 500 ? [...h.filter((_, i) => i % 2 === 1), point] : [...h, point]));
  }, [point]);

  return history;
}
