import { useState } from "react";
import { Link } from "react-router-dom";
import { GAME_TYPE_CLASS, GAME_TYPE_ICON, GAME_TYPE_LABEL, MODALITY_LABEL } from "../components/games";
import { Banner, Button, Loading, Page, cx } from "../components/ui";
import { WEEKDAYS_SHORT, addDays, formatDate, weekStart } from "../domain/time";
import { planWeek, skippedSessionIds } from "../domain/week";
import { useAppData } from "../hooks/useAppData";
import { sessionById } from "../plan/plan";

export default function Week() {
  const app = useAppData();
  const [offset, setOffset] = useState(0);
  if (!app) return <Loading />;

  const ref = addDays(weekStart(app.today), offset * 7);
  const days = planWeek({ today: app.today, sessions: app.sessions, games: app.games }, ref);
  const skipped = skippedSessionIds(app.games, ref);

  return (
    <Page
      title="Semana"
      subtitle={`${formatDate(days[0].date)} a ${formatDate(days[6].date)}${offset === 0 ? " · atual" : ""}`}
      right={
        <div className="flex gap-1">
          <Button className="w-12 px-0" onClick={() => setOffset(offset - 1)} aria-label="Semana anterior">
            ‹
          </Button>
          <Button className="w-12 px-0" onClick={() => setOffset(offset + 1)} aria-label="Próxima semana">
            ›
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        {skipped.length > 0 && (
          <Banner tone="info">Dois jogos de campeonato nesta semana: Dia 2 (HIIT) dispensado.</Banner>
        )}
        {days.map((day, i) => {
          const isToday = day.date === app.today;
          const current = day.inProgress && sessionById(day.inProgress.templateId);
          const empty = day.done.length === 0 && !current && !day.planned && day.games.length === 0;
          return (
            <div
              key={day.date}
              className={cx("bg-surface flex min-h-16 items-center gap-3 rounded-2xl px-4 py-2", isToday && "ring-accent/60 ring-2")}
            >
              <div className="w-12 shrink-0">
                <div className={cx("font-bold", isToday && "text-accent")}>{WEEKDAYS_SHORT[i]}</div>
                <div className="text-xs text-zinc-500">{formatDate(day.date)}</div>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {day.done.map((s) => (
                  <Link
                    key={s.id}
                    to={`/historico/${s.id}`}
                    className="bg-accent rounded-full px-3 py-1.5 text-sm font-semibold text-zinc-950"
                  >
                    ✓ {sessionById(s.templateId)?.name} · {sessionById(s.templateId)?.focus}
                  </Link>
                ))}
                {current && day.inProgress && (
                  <Link
                    to={`/sessao/${day.inProgress.id}`}
                    className="border-accent text-accent rounded-full border-2 px-3 py-1 text-sm font-semibold"
                  >
                    ▶ {current.name} em andamento
                  </Link>
                )}
                {day.planned && (
                  <span className="rounded-full border-2 border-dashed border-zinc-600 px-3 py-1 text-sm font-semibold text-zinc-300">
                    {day.planned.name} · {day.planned.focus}
                  </span>
                )}
                {day.games.map((g) => (
                  <span key={g.id} className={cx("rounded-full px-3 py-1.5 text-sm font-semibold", GAME_TYPE_CLASS[g.type])}>
                    {GAME_TYPE_ICON[g.type]} {GAME_TYPE_LABEL[g.type]} · {MODALITY_LABEL[g.modality]}
                    {g.time ? ` ${g.time}` : ""}
                  </span>
                ))}
                {empty && <span className="py-1.5 text-sm text-zinc-500">Descanso</span>}
              </div>
            </div>
          );
        })}
        <p className="pt-2 text-xs text-zinc-500">
          Tracejado = sessão planejada (sugestão, afastando Dia 3 e Dia 4 de jogo de campeonato e um do outro).
        </p>
        <Link to="/jogos" className="bg-surface-2 flex min-h-14 items-center justify-center rounded-2xl font-semibold">
          + Jogo
        </Link>
      </div>
    </Page>
  );
}
