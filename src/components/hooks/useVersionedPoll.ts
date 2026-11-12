"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Versioned {
  version: number | string;
}

type Unchanged = { unchanged: true; version: number | string } & Record<string, unknown>;

/**
 * Versiyalı sorğu (polling): ?v= ilə son versiya göndərilir; server "dəyişməyib" desə,
 * state yenilənmir və heç nə yenidən çəkilmir. Gizli tabda dayanır, AbortController ilə ləğv olunur.
 */
export function useVersionedPoll<T extends Versioned>(
  url: string | null,
  intervalMs: number,
  onUnchanged?: (body: Unchanged) => void,
) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const version = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const unchangedRef = useRef(onUnchanged);
  unchangedRef.current = onUnchanged;

  const poll = useCallback(async () => {
    if (!url) return;
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    try {
      const sep = url.includes("?") ? "&" : "?";
      const response = await fetch(version.current === null ? url : `${url}${sep}v=${encodeURIComponent(version.current)}`, {
        cache: "no-store",
        signal: c.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as T | Unchanged;
      setFailed(false);
      if ("unchanged" in body && body.unchanged) {
        unchangedRef.current?.(body);
        return;
      }
      version.current = String(body.version);
      setData(body as T);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setFailed(true);
    }
  }, [url]);

  /** Admin əməliyyatından dərhal sonra cavabı birbaşa tətbiq etmək üçün. */
  const apply = useCallback((next: T) => {
    version.current = String(next.version);
    setData(next);
  }, []);

  useEffect(() => {
    version.current = null;
    setData(null);
    if (!url) return;
    void poll();
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => void poll(), intervalMs);
    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearInterval(timer);
        timer = null;
        controller.current?.abort();
      } else if (!timer) {
        void poll();
        timer = setInterval(() => void poll(), intervalMs);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      controller.current?.abort();
    };
  }, [url, intervalMs, poll]);

  return { data, failed, refresh: poll, apply };
}
