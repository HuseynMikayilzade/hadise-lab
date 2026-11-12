"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/hooks/useReducedMotion";

/**
 * Dəyər dəyişəndə yeni qiymətə qədər "sayır" (300 ms, ease-out).
 * Yalnız dəyər həqiqətən dəyişəndə animasiya olunur; sürətli rejimdə və azaldılmış hərəkətdə dərhal yenilənir.
 */
export function AnimatedNumber({
  value,
  format,
  fast = false,
  className,
}: {
  value: number | null;
  format: (v: number) => string;
  fast?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (value === null || fromRef.current === null || reduced || fast || value === fromRef.current) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const duration = 300;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(from + (value - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      fromRef.current = value;
    };
  }, [value, reduced, fast]);

  return <span className={`num ${className ?? ""}`}>{shown === null ? "-" : format(shown)}</span>;
}
