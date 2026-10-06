import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function Page({
  title,
  subtitle,
  back,
  right,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28">
      <header className="pt-safe sticky top-0 z-10 -mx-4 mb-3 bg-zinc-950/95 px-4 backdrop-blur">
        <div className="flex min-h-14 items-center gap-2 py-2">
          {back && (
            <Link
              to={back}
              aria-label="Voltar"
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl text-zinc-300 active:bg-zinc-800"
            >
              ‹
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{title}</h1>
            {subtitle && <div className="truncate text-sm text-zinc-400">{subtitle}</div>}
          </div>
          {right}
        </div>
      </header>
      {children}
    </div>
  );
}

// className aqui é para layout/realce; a cor de fundo é sempre a da superfície.
export function Card({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className={cx("bg-surface rounded-2xl p-4", className)}>
      {children}
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "ghostDanger" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-zinc-950 active:bg-accent-strong",
  secondary: "bg-surface-2 text-zinc-100 active:bg-zinc-700",
  ghost: "text-zinc-300 active:bg-zinc-800",
  quiet: "text-zinc-500 active:bg-zinc-800",
  ghostDanger: "text-rose-300 active:bg-zinc-800",
  danger: "bg-rose-500/15 text-rose-300 active:bg-rose-500/25",
};

export function Button({
  variant = "secondary",
  big = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "flex items-center justify-center gap-2 rounded-2xl px-4 font-semibold transition-colors disabled:opacity-40",
        big ? "min-h-16 text-lg" : "min-h-14 text-base",
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="bg-surface-2 flex rounded-2xl p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-12 flex-1 rounded-xl px-2 text-sm font-semibold",
            o.value === value ? "bg-accent text-zinc-950" : "text-zinc-300",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-zinc-400 uppercase">{children}</h2>;
}

export function Banner({ tone, children }: { tone: "warn" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "warn" ? "alert" : "status"}
      className={cx(
        "flex gap-2 rounded-2xl px-4 py-3 text-sm",
        tone === "warn" ? "bg-amber-400/15 text-amber-200" : "bg-sky-400/15 text-sky-200",
      )}
    >
      <span aria-hidden>{tone === "warn" ? "⚠️" : "ℹ️"}</span>
      <span>{children}</span>
    </div>
  );
}

export function Loading() {
  return <div className="p-8 text-center text-zinc-500">Carregando…</div>;
}
