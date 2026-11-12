"use client";

import { QRCodeSVG } from "qrcode.react";
import { RUN_MODE_LABELS, type RunMode } from "@/experiments/types";
import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { formatInt } from "@/lib/format";

/** Daimi yığcam başlıq: QR, qısa link, iştirakçı sayı, eksperiment adı və rejim. */
export function Header({
  joinUrl,
  participants,
  title,
  mode,
  demo,
  rehearsalSeed,
  qrLarge,
  onToggleQr,
  offline,
}: {
  joinUrl: string;
  participants: number | null;
  title: string | null;
  mode: RunMode | null;
  demo: boolean;
  rehearsalSeed: number | null;
  qrLarge: boolean;
  onToggleQr: () => void;
  offline: boolean;
}) {
  const shortUrl = joinUrl.replace(/^https?:\/\//, "");
  return (
    <header className="proj-header">
      {!demo && (
        <button type="button" className="qr-button" onClick={onToggleQr} aria-keyshortcuts="Q" aria-label={qrLarge ? "QR-ı kiçilt" : "QR-ı böyüt"}>
          {joinUrl && <QRCodeSVG value={joinUrl} size={256} marginSize={1} fgColor="#22333B" title="Qoşulma linki" className="qr-small" />}
        </button>
      )}
      {!demo && (
        <div className="join-info">
          <p className="join-url">{shortUrl}</p>
          <p className="join-hint">Telefonla skan edin və ya linki açın</p>
        </div>
      )}
      {!demo && participants !== null && (
        <div className="participants">
          <AnimatedNumber value={participants} format={formatInt} className="participants-count" />
          <span>iştirakçı</span>
        </div>
      )}
      <div className="header-title">{title && <h1>{title}</h1>}</div>
      <div className="badges">
        {mode && <span className={`badge badge-mode mode-${mode}`}>{RUN_MODE_LABELS[mode]}</span>}
        {demo && <span className="badge badge-demo">Demo</span>}
        {rehearsalSeed !== null && <span className="badge badge-seed">Məşq: toxum {rehearsalSeed}</span>}
        {offline && <span className="badge badge-warn">Bağlantı yoxdur</span>}
      </div>
    </header>
  );
}

/** Böyük QR (başlanğıcda və "QR-ı böyüt" ilə). */
export function QrDock({ joinUrl, onClose }: { joinUrl: string; onClose: () => void }) {
  return (
    <div className="qr-dock">
      <p className="qr-dock-title">Telefonla skan edin</p>
      {joinUrl && <QRCodeSVG value={joinUrl} size={512} marginSize={2} fgColor="#22333B" title="Qoşulma linki" className="qr-large" />}
      <p className="join-url">{joinUrl.replace(/^https?:\/\//, "")}</p>
      <button type="button" className="ctl" onClick={onClose}>
        QR-ı kiçilt
      </button>
    </div>
  );
}
