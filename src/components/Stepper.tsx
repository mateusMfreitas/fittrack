import { useState } from "react";
import { cx } from "./ui";

const format = (n: number, decimals: number, trim: boolean) =>
  (trim && Number.isInteger(n) ? String(n) : n.toFixed(decimals)).replace(".", ",");

// Número com − / +. O teclado numérico só abre se o usuário tocar no valor.
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  decimals = 0,
  trimZeros = false,
  unit,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  // Mostra "5" em vez de "5,0" quando o valor é inteiro.
  trimZeros?: boolean;
  unit?: string;
  label: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const fmt = (n: number, d: number) => format(n, d, trimZeros);
  const clamp = (v: number) => Math.min(max, Math.max(min, Number(v.toFixed(decimals))));
  const bump = (dir: 1 | -1) => onChange(clamp(value + dir * step));

  const commit = () => {
    if (text !== null) {
      const parsed = Number(text.replace(",", "."));
      if (text.trim() !== "" && Number.isFinite(parsed)) onChange(clamp(parsed));
    }
    setText(null);
  };

  const btn =
    "bg-surface-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl font-semibold text-zinc-100 active:bg-zinc-600 disabled:opacity-30";

  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-sm text-zinc-400">{label}</span>
      <button type="button" className={btn} onClick={() => bump(-1)} disabled={value <= min} aria-label={`Diminuir ${label}`}>
        −
      </button>
      <div className="flex h-14 min-w-0 flex-1 items-center justify-center">
        {text === null ? (
          <button
            type="button"
            onClick={() => setText(fmt(value, decimals))}
            className="flex h-14 w-full items-baseline justify-center gap-1 rounded-2xl pt-2.5 active:bg-zinc-800"
            aria-label={`${label}: ${fmt(value, decimals)}${unit ? ` ${unit}` : ""}. Toque para digitar`}
          >
            <span className="text-3xl font-bold tabular-nums">{fmt(value, decimals)}</span>
            {unit && <span className="text-sm text-zinc-400">{unit}</span>}
          </button>
        ) : (
          <input
            autoFocus
            inputMode={decimals > 0 ? "decimal" : "numeric"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            aria-label={label}
            className={cx(
              "border-accent h-14 w-full rounded-2xl border-2 bg-zinc-950 text-center text-3xl font-bold tabular-nums outline-none",
            )}
          />
        )}
      </div>
      <button type="button" className={btn} onClick={() => bump(1)} disabled={value >= max} aria-label={`Aumentar ${label}`}>
        +
      </button>
    </div>
  );
}
