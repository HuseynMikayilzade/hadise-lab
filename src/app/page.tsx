import Link from "next/link";
import { DEFAULT_SESSION_CODE } from "@/lib/session-code";

export default function HomePage() {
  return (
    <main className="landing">
      <h1>Ehtimal laboratoriyası</h1>
      <p className="landing-lead">
        "Hadisələrdə əsas anlayışlar" təqdimatı üçün canlı eksperimentlər. Auditoriya QR kodu bir dəfə skan edir,
        telefonlar aktiv eksperimenti avtomatik açır, ekranda nəticələr canlı olaraq ehtimallara çevrilir.
      </p>
      <p>
        Hər eksperiment auditoriyasız da işləyir: avtonom rejimdə proqram gizli parametrlər seçir, real təsadüfi
        sınaqlar aparır və onlardan öyrənir.
      </p>
      <nav className="landing-links" aria-label="Keçidlər">
        <Link className="landing-card" href={`/s/${DEFAULT_SESSION_CODE}?admin`}>
          <strong>Proyektor ekranı</strong>
          <span>QR kod, canlı nəticələr və təqdimatçı idarəsi</span>
        </Link>
        <Link className="landing-card" href={`/s/${DEFAULT_SESSION_CODE}?demo`}>
          <strong>Demo</strong>
          <span>İnternet olmadan, yalnız avtonom rejim</span>
        </Link>
      </nav>
    </main>
  );
}
