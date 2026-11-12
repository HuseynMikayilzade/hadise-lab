import type { ReactNode } from "react";

/**
 * Eksperimentin ekran sahəsi: solda əsas vizual (hero), sağda əsas rəqəmlər,
 * altda bir cümləlik nəticə. Ekran sürüşmür - hər şey 100dvh şəbəkəsinə sığır.
 */
export function Stage({
  hero,
  side,
  instruction,
  takeaway,
  toolbar,
}: {
  hero: ReactNode;
  side: ReactNode;
  instruction?: string;
  takeaway?: string | null;
  toolbar?: ReactNode;
}) {
  return (
    <div className="stage">
      <section className="hero" aria-label="Əsas vizual">
        {(instruction || toolbar) && (
          <div className="hero-top">
            {instruction && <p className="instruction">{instruction}</p>}
            {toolbar}
          </div>
        )}
        <div className="hero-body">{hero}</div>
      </section>
      <aside className="side">{side}</aside>
      {takeaway && (
        <p className="takeaway" role="status">
          {takeaway}
        </p>
      )}
    </div>
  );
}

/** Böyük, arxa cərgədən oxunan rəqəm kartı. */
export function KeyNumber({
  label,
  children,
  detail,
  tone,
}: {
  label: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
  tone?: "a" | "b" | "sim" | "truth" | "correct";
}) {
  return (
    <div className={`key-number ${tone ? `tone-${tone}` : ""}`}>
      <p className="key-label">{label}</p>
      <p className="key-value">{children}</p>
      {detail && <p className="key-detail">{detail}</p>}
    </div>
  );
}

/** Kiçik seçim düymələri (məs. hadisə seçicisi, əməliyyat dəyişdiricisi). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value} className={o.id === value ? "active" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
