import { NavLink } from "react-router-dom";
import { cx } from "./ui";

// Traços de ícones 24×24.
const ITEMS = [
  { to: "/", label: "Hoje", icon: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { to: "/semana", label: "Semana", icon: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4" },
  { to: "/historico", label: "Histórico", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
  { to: "/evolucao", label: "Evolução", icon: "M3 3v18h18M7 15l4-4 3 3 5-6" },
  { to: "/mais", label: "Mais", icon: "M4 6h16M4 12h16M4 18h16" },
];

export function BottomNav() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cx(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  isActive ? "text-accent" : "text-zinc-400",
                )
              }
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
