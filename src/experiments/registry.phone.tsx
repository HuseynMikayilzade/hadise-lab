"use client";

import dynamic from "next/dynamic";
import type { ExperimentId } from "./types";
import { asPhone, type PhoneComponent } from "./ui-types";

const loading = () => <p className="phone-hint">Yüklənir…</p>;

/** Telefon reyestri: hər eksperimentin telefon hissəsi yalnız lazım olanda yüklənir. */
export const PHONES: Readonly<Record<ExperimentId, PhoneComponent>> = {
  dice: asPhone(dynamic(() => import("./dice/Phone").then((m) => m.DicePhone), { loading })),
  "event-types": asPhone(dynamic(() => import("./event-types/Phone").then((m) => m.EventTypesPhone), { loading })),
  seasons: asPhone(dynamic(() => import("./seasons/Phone").then((m) => m.SeasonsPhone), { loading })),
  venn: asPhone(dynamic(() => import("./venn/Phone").then((m) => m.VennPhone), { loading })),
  birthday: asPhone(dynamic(() => import("./birthday/Phone").then((m) => m.BirthdayPhone), { loading })),
  "monte-carlo": asPhone(dynamic(() => import("./monte-carlo/Phone").then((m) => m.MonteCarloPhone), { loading })),
  "bayes-test": asPhone(dynamic(() => import("./bayes-test/Phone").then((m) => m.BayesPhone), { loading })),
  "random-seq": asPhone(dynamic(() => import("./random-seq/Phone").then((m) => m.RandomSeqPhone), { loading })),
  "ab-test": asPhone(dynamic(() => import("./ab-test/Phone").then((m) => m.AbPhone), { loading })),
};
