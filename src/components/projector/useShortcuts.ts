"use client";

import { useEffect, useRef } from "react";

/**
 * Klaviatura qısayolları (yalnız təqdimatçı üçün). Form elementlərində yazarkən işləmir.
 * Açar: KeyboardEvent.key (kiçik hərflə).
 */
export function useShortcuts(enabled: boolean, handlers: Record<string, () => unknown>) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const handler = ref.current[key];
      if (!handler) return;
      // Boşluq düyməsi fokuslu düyməni də basmasın.
      if (key === " " && target?.tagName === "BUTTON") return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
