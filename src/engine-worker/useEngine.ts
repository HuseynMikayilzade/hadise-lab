"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExperimentId } from "@/experiments/types";
import type { EngineSnapshot, FromWorker, ToWorker } from "./protocol";

declare global {
  interface Window {
    /** Proyektor bütün hissələri yüklədikdə true olur (oflayn yoxlama üçün). */
    __hlPrefetched?: boolean;
    __hlFrames?: number;
  }
}

/**
 * Web Worker mühərriki ilə əlaqə. Worker səhifə açılan kimi yaradılır (oflayn rejim üçün paket
 * əvvəlcədən yüklənir) və bütün sessiya boyu yaşayır.
 */
export function useEngine(exp: ExperimentId | null, enabled: boolean, seed: number | null) {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<FromWorker>) => {
      const message = event.data;
      if (message.type === "ready") setReady(true);
      else if (message.type === "snapshot") setSnapshot(message.snapshot);
      else setFailure(message.message);
    };
    worker.onerror = (event) => setFailure(event.message || "Simulyasiya mühərriki işə düşmədi.");
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const send = useCallback((message: ToWorker) => {
    workerRef.current?.postMessage(message);
  }, []);

  useEffect(() => {
    if (ready && exp && enabled) send({ type: "init", exp, seed });
  }, [ready, exp, enabled, seed, send]);

  const current = snapshot && snapshot.exp === exp ? snapshot : null;
  return { ready, snapshot: current, failure, send };
}
