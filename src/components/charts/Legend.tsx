export type LegendItem = { label: string } & (
  | { kind: "audience" | "sim" | "truth" | "reference" }
  | { kind: "swatch"; color: string; hatched?: boolean }
);

/** Kiçik əfsanə: xətt üslubu və marker forması rəngdən əlavə fərq yaradır. */
export function Legend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul className="legend">
      {items.map((item) => (
        <li key={item.label}>
          <svg width="28" height="14" aria-hidden="true">
            {item.kind === "swatch" ? (
              <rect x="4" y="1" width="20" height="12" rx="3" fill={item.color} fillOpacity={item.hatched ? 0.45 : 1} stroke={item.color} strokeDasharray={item.hatched ? "3 2" : undefined} />
            ) : (
              <>
                <line className={`legend-line legend-${item.kind}`} x1="0" x2="28" y1="7" y2="7" />
                {item.kind === "audience" && <circle className="legend-marker legend-audience" cx="14" cy="7" r="4" />}
                {item.kind === "sim" && <rect className="legend-marker legend-sim" x="10" y="3" width="8" height="8" />}
              </>
            )}
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
