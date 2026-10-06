import { Link, useNavigate } from "react-router-dom";
import { GAME_TYPE_CLASS, GAME_TYPE_ICON } from "../components/games";
import { SyncBadge } from "../components/SyncBadge";
import { Banner, Button, Card, Loading, Page, SectionTitle, cx } from "../components/ui";
import { startSession } from "../db/repo";
import { sessionAlerts } from "../domain/alerts";
import { pendingMeasures } from "../domain/reminders";
import { WEEKDAYS_SHORT, formatDateLong } from "../domain/time";
import { doneTemplateIds, planWeek, skippedSessionIds, suggestToday } from "../domain/week";
import { useAppData } from "../hooks/useAppData";
import { primeAudio } from "../hooks/useBeep";
import { SESSIONS, type SessionTemplate } from "../plan/plan";

export default function Today() {
  const app = useAppData();
  const navigate = useNavigate();
  if (!app) return <Loading />;

  const ctx = { today: app.today, sessions: app.sessions, games: app.games };
  const suggestion = suggestToday(ctx);
  const done = doneTemplateIds(app.sessions, app.today);
  const skipped = skippedSessionIds(app.games, app.today);
  const pending = pendingMeasures(app.measurements, app.today);
  const week = planWeek(ctx);
  const doneToday = app.sessions.filter((s) => s.status === "done" && s.date === app.today);
  const alertsOf = (t: SessionTemplate) => sessionAlerts(t.id, { nowMs: app.nowMs, sessions: app.sessions, games: app.games });

  const start = async (templateId: string) => {
    primeAudio();
    const session = await startSession(templateId);
    navigate(`/sessao/${session.id}`);
  };

  const suggested = suggestion.kind === "rest" ? null : suggestion.template;

  return (
    <Page
      title="Hoje"
      subtitle={`${formatDateLong(app.today)} · semana ${app.cycleWeek} do ciclo`}
      right={<SyncBadge />}
    >
      <div className="space-y-3">
        {pending.map((type) => (
          <Link
            key={type}
            to="/medidas"
            className="flex min-h-14 items-center justify-between rounded-2xl bg-sky-400/15 px-4 font-semibold text-sky-200"
          >
            <span>📏 {type === "peso" ? "Pesagem da semana pendente" : "Medida de cintura pendente"}</span>
            <span aria-hidden>›</span>
          </Link>
        ))}

        {app.deload && <Banner tone="info">Semana de redução: séries alvo pela metade.</Banner>}

        <Card className="space-y-3">
          {suggested ? (
            <>
              <div>
                <div className="text-sm text-zinc-400">
                  {suggestion.kind === "continue"
                    ? "Sessão em andamento"
                    : doneToday.length > 0
                      ? "Treino de hoje feito ✓ · próxima da semana"
                      : "Sessão sugerida"}
                </div>
                <div className="text-3xl font-black">{suggested.name}</div>
                <div className="text-lg text-zinc-300">{suggested.focus}</div>
              </div>
              {alertsOf(suggested).map((a) => (
                <Banner key={a.message} tone="warn">
                  {a.message}
                </Banner>
              ))}
              <Button variant="primary" big className="w-full" onClick={() => void start(suggested.id)}>
                {suggestion.kind === "continue" ? "Continuar sessão" : "Iniciar sessão"}
              </Button>
            </>
          ) : (
            <div className="py-4 text-center">
              <div className="text-3xl font-black">Descanso 😌</div>
              <div className="text-zinc-400">Todas as sessões da semana foram feitas.</div>
            </div>
          )}
        </Card>

        <SectionTitle>Semana</SectionTitle>
        <Link to="/semana" className="bg-surface grid grid-cols-7 gap-1 rounded-2xl p-3" aria-label="Ver semana">
          {week.map((day, i) => {
            const label = day.done[0]
              ? SESSIONS.find((s) => s.id === day.done[0].templateId)?.name.replace("Dia ", "D")
              : (day.inProgress ?? day.planned)
                ? `D${(day.inProgress ? SESSIONS.find((s) => s.id === day.inProgress!.templateId) : day.planned)?.order}`
                : "";
            return (
              <div key={day.date} className="flex flex-col items-center gap-1">
                <span className={cx("text-xs", day.date === app.today ? "text-accent font-bold" : "text-zinc-500")}>
                  {WEEKDAYS_SHORT[i]}
                </span>
                <span
                  className={cx(
                    "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
                    day.done.length > 0
                      ? "bg-accent text-zinc-950"
                      : label
                        ? "border-2 border-dashed border-zinc-600 text-zinc-300"
                        : "bg-surface-2 text-zinc-600",
                  )}
                >
                  {day.done.length > 0 ? "✓" : label || "·"}
                </span>
                <span className="flex h-5 items-center gap-0.5 text-xs">
                  {day.games.map((g) => (
                    <span key={g.id} className={cx("rounded px-0.5", GAME_TYPE_CLASS[g.type])} title={g.type}>
                      {GAME_TYPE_ICON[g.type]}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </Link>

        <SectionTitle>Sessões da semana</SectionTitle>
        <div className="space-y-2">
          {SESSIONS.map((t) => {
            const isDone = done.has(t.id);
            const isSkipped = skipped.includes(t.id);
            const alerts = alertsOf(t);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => void start(t.id)}
                className="bg-surface flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left active:bg-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {t.name} <span className="font-normal text-zinc-400">· {t.focus}</span>
                  </div>
                  {alerts.length > 0 && !isDone && (
                    <div className="text-sm text-amber-300">⚠️ {alerts[0].message}</div>
                  )}
                  {isSkipped && !isDone && (
                    <div className="text-sm text-zinc-400">Dispensado: dois jogos de campeonato na semana</div>
                  )}
                </div>
                <span className={cx("shrink-0 text-sm font-semibold", isDone ? "text-accent" : "text-zinc-500")}>
                  {isDone ? "✓ feita" : isSkipped ? "dispensada" : "iniciar ›"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Page>
  );
}
