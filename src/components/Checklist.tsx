import { cx } from "./ui";

// Lista fixa marcável (aquecimento e pós-treino).
export function Checklist({
  title,
  items,
  checked,
  onToggle,
  collapsed = false,
}: {
  title: string;
  items: string[];
  checked: number[];
  onToggle: (index: number) => void;
  // Fecha a lista mesmo incompleta (ex.: o treino já começou).
  collapsed?: boolean;
}) {
  const done = checked.length >= items.length;
  return (
    <details className="bg-surface group rounded-2xl" open={!done && !collapsed}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-semibold">
        <span>{title}</span>
        <span className={cx("text-sm", done ? "text-accent" : "text-zinc-400")}>
          {done ? "✓ feito" : `${checked.length}/${items.length}`}
        </span>
      </summary>
      <ul className="px-2 pb-2">
        {items.map((item, i) => {
          const on = checked.includes(i);
          return (
            <li key={item}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => onToggle(i)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left active:bg-zinc-800"
              >
                <span
                  className={cx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold",
                    on ? "border-accent bg-accent text-zinc-950" : "border-zinc-600",
                  )}
                >
                  {on && "✓"}
                </span>
                <span className={cx(on && "text-zinc-500 line-through")}>{item}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
