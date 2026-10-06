import { Link } from "react-router-dom";
import { SyncBadge } from "../components/SyncBadge";
import { Page } from "../components/ui";

const LINKS = [
  { to: "/medidas", icon: "📏", label: "Medidas", hint: "Peso e cintura" },
  { to: "/jogos", icon: "⚽", label: "Jogos", hint: "Campeonato, treino e brincadeira" },
  { to: "/config", icon: "⚙️", label: "Configurações", hint: "Ciclo, HIIT, exportar e importar" },
];

export default function More() {
  return (
    <Page title="Mais" right={<SyncBadge />}>
      <ul className="space-y-2">
        {LINKS.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="bg-surface flex min-h-16 items-center gap-4 rounded-2xl px-4 active:bg-zinc-800">
              <span aria-hidden className="text-2xl">
                {l.icon}
              </span>
              <span className="flex-1">
                <span className="block font-bold">{l.label}</span>
                <span className="block text-sm text-zinc-400">{l.hint}</span>
              </span>
              <span aria-hidden className="text-zinc-500">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
