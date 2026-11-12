"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface ChartSize {
  width: number;
  height: number;
}

/**
 * Diaqram konteynerini ölçür və SVG-ni real piksel ölçüsündə çəkir (viewBox = piksel).
 * Beləcə mətn ölçüsü (CSS px) diaqramın kiçilib-böyüməsindən asılı olmayaraq oxunaqlı qalır.
 */
export function ChartFrame({ children, minHeight = 120 }: { children: (size: ChartSize) => ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.max(200, Math.round(rect.width));
      const height = Math.max(minHeight, Math.round(rect.height));
      setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [minHeight]);

  return (
    <div className="chart-frame" ref={ref}>
      {size && children(size)}
    </div>
  );
}
