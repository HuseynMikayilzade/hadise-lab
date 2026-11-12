import { OMEGA } from "./definition";

/**
 * Ω = {1, ..., 6} kiçik diaqramı: hər nəticə bir dairədir.
 * A-ya daxil olanlar teal, B-yə daxil olanlar mərcan, hər ikisinə daxil olanlar yarı-yarı rənglənir.
 */
export function OmegaTokens({ a, b, label }: { a: readonly number[]; b?: readonly number[]; label: string }) {
  const r = 22;
  return (
    <svg className="omega-tokens" viewBox="0 0 360 96" role="img" aria-label={label}>
      <rect className="omega" x="2" y="2" width="356" height="92" rx="12" />
      <text className="omega-label small" x="14" y="30">Ω</text>
      {OMEGA.map((value, i) => {
        const cx = 66 + i * 50;
        const cy = 50;
        const inA = a.includes(value);
        const inB = b?.includes(value) ?? false;
        return (
          <g key={value} className="token">
            {inA && inB ? (
              <>
                <path d={`M${cx},${cy - r} A${r},${r} 0 0 0 ${cx},${cy + r} Z`} className="token-a" />
                <path d={`M${cx},${cy - r} A${r},${r} 0 0 1 ${cx},${cy + r} Z`} className="token-b" />
              </>
            ) : (
              <circle cx={cx} cy={cy} r={r} className={inA ? "token-a" : inB ? "token-b" : "token-none"} />
            )}
            <circle cx={cx} cy={cy} r={r} className="token-ring" />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className={inA || inB ? "token-text on" : "token-text"}>
              {value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
