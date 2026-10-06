import { useState } from "react";
import { GAME_TYPE_CLASS, GAME_TYPE_ICON, GAME_TYPE_LABEL, MODALITY_LABEL } from "../components/games";
import { Button, Card, Loading, Page, SectionTitle, Segmented, cx } from "../components/ui";
import { addGame, deleteGame } from "../db/repo";
import type { Game, GameModality, GameType } from "../db/types";
import { formatDateLong } from "../domain/time";
import { useAppData } from "../hooks/useAppData";

export default function Games() {
  const app = useAppData();
  const [type, setType] = useState<GameType>("campeonato");
  const [modality, setModality] = useState<GameModality>("futsal");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState("");
  const [saved, setSaved] = useState(false);
  if (!app) return <Loading />;

  const theDate = date ?? app.today;
  const save = async () => {
    await addGame({ date: theDate, time: time || null, modality, type });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const byDate = (a: Game, b: Game) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");
  const upcoming = app.games.filter((g) => g.date >= app.today).sort(byDate);
  const past = app.games.filter((g) => g.date < app.today).sort((a, b) => byDate(b, a)).slice(0, 30);

  const row = (g: Game) => (
    <li key={g.id} className="bg-surface flex min-h-16 items-center gap-3 rounded-2xl pr-1 pl-4">
      <div className="min-w-0 flex-1 py-2">
        <div className="font-semibold">
          {formatDateLong(g.date)}
          {g.time ? ` às ${g.time}` : ""}
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
          <span className={cx("rounded-full px-2.5 py-0.5 font-semibold", GAME_TYPE_CLASS[g.type])}>
            {GAME_TYPE_ICON[g.type]} {GAME_TYPE_LABEL[g.type]}
          </span>
          {MODALITY_LABEL[g.modality]}
        </div>
      </div>
      <Button
        variant="quiet"
        className="w-12 px-0"
        aria-label="Apagar jogo"
        onClick={() => window.confirm("Apagar este jogo?") && void deleteGame(g.id)}
      >
        ✕
      </Button>
    </li>
  );

  return (
    <Page title="Jogos" back="/mais">
      <Card className="space-y-3">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "campeonato", label: "Campeonato" },
            { value: "treino", label: "Treino" },
            { value: "brincadeira", label: "Brincadeira" },
          ]}
        />
        <p className="text-sm text-zinc-400">
          {type === "campeonato"
            ? "Cadastre com antecedência: gera o alerta de 48 h no Dia 3 e no Dia 4."
            : "Só registro de atividade: não muda sugestões nem alertas."}
        </p>
        <Segmented
          value={modality}
          onChange={setModality}
          options={[
            { value: "futsal", label: "Futsal" },
            { value: "society", label: "Society" },
          ]}
        />
        <div className="flex gap-2">
          <label className="flex-1 text-sm text-zinc-400">
            Data
            <input
              type="date"
              value={theDate}
              onChange={(e) => setDate(e.target.value || null)}
              className="bg-surface-2 mt-1 block min-h-14 w-full rounded-2xl px-3 text-base text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-400">
            Hora (opcional)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-surface-2 mt-1 block min-h-14 w-full rounded-2xl px-3 text-base text-zinc-100"
            />
          </label>
        </div>
        <Button variant="primary" big className="w-full" onClick={() => void save()}>
          {saved ? "✓ Salvo" : "Salvar jogo"}
        </Button>
      </Card>

      <SectionTitle>Próximos</SectionTitle>
      {upcoming.length === 0 && <p className="text-zinc-500">Nenhum jogo marcado.</p>}
      <ul className="space-y-2">{upcoming.map(row)}</ul>

      {past.length > 0 && (
        <>
          <SectionTitle>Passados</SectionTitle>
          <ul className="space-y-2">{past.map(row)}</ul>
        </>
      )}
    </Page>
  );
}
